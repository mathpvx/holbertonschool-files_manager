import { ObjectId } from 'mongodb';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import path from 'path';
import dbClient from './utils/db';
import { fileQueue } from './utils/queue';

fileQueue.process(async (job, done) => {
  const { userId, fileId } = job.data;

  if (!fileId) return done(new Error('Missing fileId'));
  if (!userId) return done(new Error('Missing userId'));

  const file = await dbClient.db.collection('files').findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });

  if (!file) return done(new Error('File not found'));

  if (file.type !== 'image') return done(); // Skip non-image

  try {
    const thumbnailSizes = [500, 250, 100];
    await Promise.all(
      thumbnailSizes.map(async (size) => {
        const thumbnail = await imageThumbnail(file.localPath, { width: size });
        const thumbPath = `${file.localPath}_${size}`;
        await fs.promises.writeFile(thumbPath, thumbnail);
      })
    );
    done();
  } catch (err) {
    console.error(err);
    done(err);
  }
});
