import dbClient from '../utils/db';
import sha1 from 'sha1';
import redisClient from '../utils/redis';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const user = await dbClient.usersCollection.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const newUser = {
      email,
      password: sha1(password),
    };

    const result = await dbClient.usersCollection.insertOne(newUser);
    return res.status(201).json({ id: result.insertedId, email });
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.usersCollection.findOne({
      _id: dbClient.client.bson.ObjectID(userId),
    });

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    return res.status(200).json({ id: user._id, email: user.email });
  }
}

export default UsersController;
