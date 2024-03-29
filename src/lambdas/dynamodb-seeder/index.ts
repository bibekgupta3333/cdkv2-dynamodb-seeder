import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { S3 } from "@aws-sdk/client-s3";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import type { CloudFormationCustomResourceEvent } from "aws-lambda";
import {
  customResourceHelper,
  OnCreateHandler,
  ResourceHandler,
  ResourceHandlerReturn
} from "custom-resource-helper";
import chunk from "lodash.chunk";

// DynamoDB has a 25 item limit in batch requests
// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html
const MAX_BATCH_CHUNK = 25;

interface DynamoDBSeederProps {
  tableName: string;
  seeds: {
    inlineSeeds?: string;
    s3Bucket?: string;
    s3Key?: string;
    s3ObjectVersion?: string;
  };
}

type Seeds = Record<string, unknown>[];

const dynamodb = DynamoDBDocument.from(new DynamoDB());
const s3 = new S3();

const getProperties = (
  props: CloudFormationCustomResourceEvent["ResourceProperties"]
): DynamoDBSeederProps => ({
  tableName: props.TableName,
  seeds: {
    inlineSeeds: props.Seeds.InlineSeeds,
    s3Bucket: props.Seeds.S3Bucket,
    s3Key: props.Seeds.S3Key,
    s3ObjectVersion: props.Seeds.S3ObjectVersion
  }
});

const handleCreate: OnCreateHandler = async (event): Promise<ResourceHandlerReturn> => {
  const props = getProperties(event.ResourceProperties);

  const { inlineSeeds, ...s3Location } = props.seeds;

  const seeds = inlineSeeds ? (JSON.parse(inlineSeeds) as Seeds) : await getSeedsFromS3(s3Location);

  await writeSeeds(props.tableName, seeds);

  console.log(`Seed running complete for table ${props.tableName}`);

  return {
    physicalResourceId: event.RequestId
  };
};

const getSeedsFromS3 = async (s3Location: {
  s3Bucket?: string;
  s3Key?: string;
  s3ObjectVersion?: string;
}): Promise<Seeds> => {
  const { s3Bucket, s3Key, s3ObjectVersion } = s3Location;

  if (!s3Bucket || !s3Key) {
    throw new Error("Bucket configuration missing!");
  }

  const { Body: body } = await s3.getObject({
    Bucket: s3Bucket,
    Key: s3Key,
    VersionId: s3ObjectVersion
  });

  if (!body) {
    throw new Error(`Cannot load seeds from bucket ${s3Bucket} with key ${s3Key}`);
  }

  return JSON.parse(body.toString()) as Seeds;
};

const writeSeeds = async (tableName: string, seeds: Seeds): Promise<void> => {
  const seedChunks = chunk(seeds, MAX_BATCH_CHUNK);

  console.log(`Sending data to dynamodb: ${seedChunks.length} chunks`);

  await Promise.all(
    seedChunks.map(async (seedChunk) => {
      const requests = seedChunk.map((seed) => ({
        PutRequest: {
          Item: seed
        }
      }));

      return dynamodb.batchWrite({
        RequestItems: {
          [tableName]: requests
        }
      });
    })
  );
};

const handler = customResourceHelper(
  (): ResourceHandler => ({
    onCreate: handleCreate
  })
);
export { handler };
