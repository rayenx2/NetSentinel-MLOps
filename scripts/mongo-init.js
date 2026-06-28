// MongoDB initialization script
// Creates the TEST_DB database and NetworkData collection
db = db.getSiblingDB('TEST_DB');
db.createCollection('NetworkData');
print('NetSentinel-MLOps: TEST_DB.NetworkData collection created');
