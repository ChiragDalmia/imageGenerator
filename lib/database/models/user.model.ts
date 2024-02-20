import { Document, Schema, model, models, Types } from 'mongoose';

export interface IUser extends Document {
  clerkId: string;
  email: string;
  username: string;
  photo: string; 
  firstName?: string; 
  lastName?: string; 
  planId: number; 
  creditBalance: number; 
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  photo: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  planId: { type: Number, default: 1 }, 
  creditBalance: { type: Number, default: 10 },
  createdAt: { type: Date, default: Date.now },
});

const User = models?.User || model<IUser>('User', UserSchema);

export default User;
