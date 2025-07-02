import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) return res.status(400).json({ error: 'Missing data' });

    let parent = null;
    if (parentId !== 0) {
      try {
        parent = await dbClient.filesCollection.findOne({ _id: ObjectId(parentId) });
        if (!parent) return res.status(400).json({ error: 'Parent not found' });
        if (parent.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
      } catch {
        return res.status(400).json({ error: 'Parent not found' });
      }
    }

    const newFile = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.filesCollection.insertOne(newFile);
      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const localPath = `${folderPath}/${uuidv4()}`;
    fs.writeFileSync(localPath, Buffer.from(data, 'base64'));
    newFile.localPath = localPath;

    const result = await dbClient.filesCollection.insertOne(newFile);
    return res.status(201).json({
      id: result.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  static async getShow(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let fileId;
    try {
      fileId = ObjectId(req.params.id);
    } catch {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.filesCollection.findOne({
      _id: fileId,
      userId: ObjectId(userId),
    });

    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentId = req.query.parentId || 0;
    const page = parseInt(req.query.page || '0', 10);

    let parentQuery;
    if (parentId === '0' || parentId === 0) {
      parentQuery = 0;
    } else {
      try {
        parentQuery = ObjectId(parentId);
      } catch {
        return res.status(200).json([]);
      }
    }

    const matchQuery = {
      userId: ObjectId(userId),
      parentId: parentQuery,
    };

    try {
      const files = await dbClient.filesCollection
        .aggregate([
          { $match: matchQuery },
          { $skip: page * 20 },
          { $limit: 20 },
        ])
        .toArray();

      const result = files.map((file) => ({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      }));

      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default FilesController;
