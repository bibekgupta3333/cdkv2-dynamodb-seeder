# cdkv2-dynamodb-seeder

> A seeder for dynamodb tables

## Install

TypeScript/JavaScript:

```bash
npm i cdkv2-dynamodb-seeder
```

## How to use

```typescript
import * as path from "path";
import { Construct, Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Table, AttributeType } from "aws-cdk-lib/aws-dynamodb";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { DynamoDBSeeder, Seeds } from "cdkv2-dynamodb-seeder";

export class DynamoDBSeederStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const table = new Table(this, "Table", {
      partitionKey: {
        name: "id",
        type: AttributeType.NUMBER
      },
      removalPolicy: RemovalPolicy.DESTROY
    });

    new DynamoDBSeeder(this, "JsonFileSeeder", {
      table,
      seeds: Seeds.fromJsonFile(path.join(__dirname, "..", "seeds.json"))
    });

    new DynamoDBSeeder(this, "InlineSeeder", {
      table,
      seeds: Seeds.fromInline([
        {
          id: 3,
          column: "foo"
        },
        {
          id: 4,
          column: "bar"
        }
      ])
    });

    const seedsBucket = Bucket.fromBucketName(this, "SeedsBucket", "my-seeds-bucket");

    new DynamoDBSeeder(this, "BucketSeeder", {
      table,
      seeds: Seeds.fromBucket(seedsBucket, "seeds.json")
    });
  }
}
```

### Modified From Repo

• @cloudcomponents/cdk-dynamodb-seeder
