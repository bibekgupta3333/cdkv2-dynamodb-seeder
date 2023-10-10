import * as path from "path";
import { Stack } from "aws-cdk-lib";
import { AttributeType, Table, TableEncryption } from "aws-cdk-lib/aws-dynamodb";
import { Bucket } from "aws-cdk-lib/aws-s3";
import "jest-cdk-snapshot";

import { DynamoDBSeeder } from "../src/dynamodb-seeder";
import { Seeds } from "../src/seeds";

test("inline", () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, "Table", {
    partitionKey: {
      name: "id",
      type: AttributeType.NUMBER
    }
  });

  // WHEN
  new DynamoDBSeeder(stack, "DynamoDBSeeder", {
    table,
    seeds: Seeds.fromInline([
      {
        id: 1,
        column: "foo"
      },
      {
        id: 2,
        column: "bar"
      }
    ])
  });

  // THEN
  expect(stack).toMatchCdkSnapshot();
});

test("json file", () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, "Table", {
    partitionKey: {
      name: "id",
      type: AttributeType.NUMBER
    }
  });

  // WHEN
  new DynamoDBSeeder(stack, "DynamoDBSeeder", {
    table,
    seeds: Seeds.fromJsonFile(path.join(__dirname, "mocks", "seeds.json"))
  });

  // THEN
  expect(stack).toMatchCdkSnapshot();
});

test("json file: no such file", () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, "Table", {
    partitionKey: {
      name: "id",
      type: AttributeType.NUMBER
    }
  });

  // WHEN
  const addSeeder = () => {
    new DynamoDBSeeder(stack, "DynamoDBSeeder", {
      table,
      seeds: Seeds.fromJsonFile(path.join(__dirname, "mocks", "XYZ.json"))
    });
  };

  // THEN
  expect(() => addSeeder()).toThrowError(/Cannot find asset at/);
});

test("json file: no json file", () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, "Table", {
    partitionKey: {
      name: "id",
      type: AttributeType.NUMBER
    }
  });

  // WHEN
  const addSeeder = () => {
    new DynamoDBSeeder(stack, "DynamoDBSeeder", {
      table,
      seeds: Seeds.fromJsonFile(path.join(__dirname, "mocks", "nojson.txt"))
    });
  };

  // THEN
  expect(() => addSeeder()).toThrowError(new Error("Could not convert file to JSON"));
});

test("bucket", () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, "Table", {
    partitionKey: {
      name: "id",
      type: AttributeType.NUMBER
    }
  });

  const seedsBucket = Bucket.fromBucketName(stack, "SeedsBucket", "my-seeds-bucket");

  // WHEN
  new DynamoDBSeeder(stack, "DynamoDBSeeder", {
    table,
    seeds: Seeds.fromBucket(seedsBucket, "seeds.json")
  });

  // THEN
  expect(stack).toMatchCdkSnapshot();
});

test("multiple seeders", () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, "Table", {
    partitionKey: {
      name: "id",
      type: AttributeType.NUMBER
    }
  });

  const seedsBucket1 = Bucket.fromBucketName(stack, "SeedsBucket1", "seeds-bucket-one");
  const seedsBucket2 = Bucket.fromBucketName(stack, "SeedsBucket2", "seeds-bucket-two");

  // WHEN
  new DynamoDBSeeder(stack, "DynamoDBSeeder1", {
    table,
    seeds: Seeds.fromBucket(seedsBucket1, "seeds-one.json")
  });
  // WHEN
  new DynamoDBSeeder(stack, "DynamoDBSeeder2", {
    table,
    seeds: Seeds.fromBucket(seedsBucket2, "seeds-two.json")
  });

  // THEN
  expect(stack).toMatchCdkSnapshot();
});

test("customer managed encryption key", () => {
  // GIVEN
  const stack = new Stack();
  const table = new Table(stack, "Table", {
    partitionKey: {
      name: "id",
      type: AttributeType.NUMBER
    },
    encryption: TableEncryption.CUSTOMER_MANAGED
  });

  // WHEN
  new DynamoDBSeeder(stack, "DynamoDBSeeder", {
    table,
    seeds: Seeds.fromInline([
      {
        id: 1,
        column: "foo"
      },
      {
        id: 2,
        column: "bar"
      }
    ])
  });

  // THEN
  expect(stack).toMatchCdkSnapshot();
});
