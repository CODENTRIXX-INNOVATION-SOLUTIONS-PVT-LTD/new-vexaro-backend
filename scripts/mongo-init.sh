#!/bin/bash

# Wait for MongoDB to start
sleep 10

# Initialize replica set
mongosh --host localhost:27017 -u admin -p admin123 --authenticationDatabase admin <<EOF
var config = {
    "_id": "rs0",
    "version": 1,
    "members": [
        {
            "_id": 0,
            "host": "mongodb-primary:27017",
            "priority": 2
        }
    ]
};

// Check if replica set is already initialized
try {
    rs.status();
    print("Replica set already initialized");
} catch (e) {
    print("Initializing replica set...");
    rs.initiate(config);
    print("Replica set initialized successfully");
}

// Wait for replica set to be ready
while (rs.status().ok !== 1) {
    print("Waiting for replica set to be ready...");
    sleep(1000);
}

print("Replica set is ready!");
EOF
