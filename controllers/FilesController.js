import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';
import { ObjectId } from 'mongodb'; // ✅ Fix here
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    let parentFile = null;
    if (parentId !== 0) {
      try {
        parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
        if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
        if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
      } catch {
        return res.status(400).json({ error: 'Parent not found' });
      }
    }

    const newFile = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId,
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(newFile);
      return res.status(201).json({ id: result.insertedId, ...newFile });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const localPath = path.join(folderPath, uuidv4());
    const fileData = Buffer.from(data, 'base64');
    await fs.promises.writeFile(localPath, fileData);

    newFile.localPath = localPath;

    const result = await dbClient.db.collection('files').insertOne(newFile);
    return res.status(201).json({ id: result.insertedId, ...newFile });
  }

  static async getShow(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let file;
    try {
      file = await dbClient.db.collection('files').findOne({
        _id: ObjectId(req.params.id),
        userId: ObjectId(userId),
      });
    } catch {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!file) return res.status(404).json({ error: 'Not found' });

    const { _id, ...rest } = file;
    return res.status(200).json({ id: _id, ...rest });
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;
    const pageSize = 20;

    const query = { userId: ObjectId(userId) };
    if (parentId !== '0') query.parentId = parentId;

    const files = await dbClient.db.collection('files')
      .aggregate([
        { $match: query },
        { $skip: page * pageSize },
        { $limit: pageSize },
      ])
      .toArray();

    const response = files.map((file) => {
      const { _id, ...rest } = file;
      return { id: _id, ...rest };
    });

    return res.status(200).json(response);
  }
}

export default FilesController;
