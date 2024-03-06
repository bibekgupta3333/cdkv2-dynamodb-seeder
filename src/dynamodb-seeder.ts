import * as path from "path";
import {
  CustomResource,
  Duration,
  aws_iam as iam,
  aws_dynamodb as dynamodb,
  aws_s3 as s3
} from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

import { Seeds } from "./seeds";

export interface DynamoDBSeederProps {
  readonly table: dynamodb.ITable;
  readonly seeds: Seeds;

  /**
   * The function execution time (in seconds) after which Lambda terminates
   * the function. Because the execution time affects cost, set this value
   * based on the function's expected execution time.
   *
   * @default Duration.minutes(15)
   */
  readonly timeout?: Duration;
}

export class DynamoDBSeeder extends Construct {
  constructor(scope: Construct, id: string, props: DynamoDBSeederProps) {
    super(scope, id);

    const seeds = props.seeds.bind(this);
    const seedsBucket = seeds.s3Location?.bucketName
      ? s3.Bucket.fromBucketName(this, "SeedsBucket", seeds.s3Location.bucketName)
      : undefined;
    const entryPath = path.join(__dirname, "lambdas", "dynamodb-seeder", "index.js");
    console.log(entryPath);
    const handler = new NodejsFunction(this, "CustomResourceHandler", {
      runtime: Runtime.NODEJS_16_X,
      entry: path.join(__dirname, "lambdas", "dynamodb-seeder", "index.js"),
      handler: "handler",
      memorySize: 512,
      timeout: props.timeout ?? Duration.minutes(15),
      bundling: {
        minify: true, // minify code, defaults to false
        sourceMap: true,
        target: "es2020", // target environment for the generated JavaScript code
        metafile: true // include meta file, defaults to false
      },
      environment: {
        NODE_OPTIONS: "--enable-source-maps"
      }
    });

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["dynamodb:BatchWriteItem"],
        resources: [props.table.tableArn]
      })
    );

    if (props.table.encryptionKey) {
      handler.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "kms:Encrypt",
            "kms:Decrypt",
            "kms:ReEncrypt*",
            "kms:GenerateDataKey*",
            "kms:DescribeKey",
            "kms:CreateGrant"
          ],
          resources: [props.table.encryptionKey.keyArn]
        })
      );
    }

    if (seedsBucket) {
      const objectKey = seeds.s3Location?.objectKey ?? "*";

      handler.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["s3:GetObject"],
          resources: [seedsBucket.arnForObjects(objectKey)]
        })
      );
    }

    new CustomResource(this, "CustomResource", {
      serviceToken: handler.functionArn,
      resourceType: "Custom::DynamodbSeeder",
      properties: {
        TableName: props.table.tableName,
        Seeds: {
          InlineSeeds: seeds.inlineSeeds,
          S3Bucket: seeds.s3Location && seeds.s3Location.bucketName,
          S3Key: seeds.s3Location && seeds.s3Location.objectKey,
          S3ObjectVersion: seeds.s3Location && seeds.s3Location.objectVersion
        }
      }
    });
  }
}
