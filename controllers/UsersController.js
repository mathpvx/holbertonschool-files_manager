import dbClient from '../utils/db';
import sha1 from 'sha1';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    try {
      const existingUser = await dbClient.usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Already exist' });
      }

      const hashedPassword = sha1(password);
      const newUser = { email, password: hashedPassword };

      const result = await dbClient.usersCollection.insertOne(newUser);
      return res.status(201).json({ id: result.insertedId, email });
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  }
}

export default UsersController;
