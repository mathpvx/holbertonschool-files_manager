import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.usersCollection.findOne({
      _id: dbClient.client.bson.ObjectID(userId),
    });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    let parentObj = null;
    if (parentId !== 0) {
      try {
        parentObj = await dbClient.filesCollection.findOne({
          _id: dbClient.client.bson.ObjectID(parentId),
        });
        if (!parentObj) return res.status(400).json({ error: 'Parent not found' });
        if (parentObj.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'Parent not found' });
      }
    }

    const fileData = {
      userId: user._id,
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : dbClient.client.bson.ObjectID(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.filesCollection.insertOne(fileData);
      return res.status(201).json({
        id: result.insertedId,
        userId: user._id,
        name,
        type,
        isPublic,
        parentId,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    await fs.promises.mkdir(folderPath, { recursive: true });

    const localPath = path.join(folderPath, uuidv4());
    await fs.promises.writeFile(localPath, Buffer.from(data, 'base64'));

    fileData.localPath = localPath;
    const result = await dbClient.filesCollection.insertOne(fileData);

    return res.status(201).json({
      id: result.insertedId,
      userId: user._id,
      name,
      type,
      isPublic,
      parentId,
    });
  }
}

export default FilesController;
