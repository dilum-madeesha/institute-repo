import mongoose, { Document, Schema } from 'mongoose';

export interface IAppSetting extends Document {
  key: string;
  value: any;
  description?: string;
  updatedAt: Date;
}

const AppSettingSchema = new Schema<IAppSetting>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    description: { type: String },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  }
);

export const AppSetting = mongoose.model<IAppSetting>('AppSetting', AppSettingSchema);
