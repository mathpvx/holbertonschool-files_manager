import mongodb from 'mongodb';
const { MongoClient } = mongodb;

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const dbName = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url, { useUnifiedTopology: true });

    this.client.connect((err) => {
      if (!err) {
        this.db = this.client.db(dbName);
        this.usersCollection = this.db.collection('users');
        this.filesCollection = this.db.collection('files');
      } else {
        this.db = null;
        console.error('MongoDB connection error:', err.message);
      }
    });
  }

  isAlive() {
    return !!this.db;
  }

  async nbUsers() {
    return this.usersCollection ? this.usersCollection.countDocuments() : 0;
  }

  async nbFiles() {
    return this.filesCollection ? this.filesCollection.countDocuments() : 0;
  }
}

const dbClient = new DBClient();
export default dbClient;
