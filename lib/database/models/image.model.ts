import { Document, Schema, model, models } from 'mongoose';

export interface IImage extends Document {
  title: string;
  transformationType: string;
  publicId: string;
  secureURL: string;
  width?: number;
  height?: number;
  config?: object;
  transformationUrl?: string;
  aspectRatio?: string;
  color?: string;
  prompt?: string;
  author: {
    _id: string,
    firstName: string,
    lastName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ImageSchema = new Schema<IImage>(
  {
    title: { type: String, required: true },
    transformationType: { type: String, required: true },
    publicId: { type: String, required: true },
    secureURL: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
    config: { type: Object },
    transformationUrl: { type: String },
    aspectRatio: { type: String },
    color: { type: String },
    prompt: { type: String },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  // Mongoose maintains createdAt/updatedAt automatically, so updatedAt is
  // actually bumped on updates (the manual defaults never were).
  { timestamps: true }
);

// The gallery sorts by updatedAt and the profile filters by author.
ImageSchema.index({ updatedAt: -1 });
ImageSchema.index({ author: 1, updatedAt: -1 });

const Image = models?.Image || model<IImage>('Image', ImageSchema);

export default Image;
