import mongoose from "mongoose";

const boundingBoxSchema = new mongoose.Schema(
  {
    x: {
      type: Number,
      required: [true, "Bounding box x coordinate is required."],
      min: [0, "x coordinate cannot be negative."],
    },
    y: {
      type: Number,
      required: [true, "Bounding box y coordinate is required."],
      min: [0, "y coordinate cannot be negative."],
    },
    width: {
      type: Number,
      required: [true, "Bounding box width is required."],
      min: [0, "Width cannot be negative."],
    },
    height: {
      type: Number,
      required: [true, "Bounding box height is required."],
      min: [0, "Height cannot be negative."],
    },
    confidence: {
      type: Number,
      min: [0, "Confidence cannot be less than 0."],
      max: [1, "Confidence cannot exceed 1."],
    },
    class: {
      type: String,
      trim: true,
      maxlength: [100, "Detected class label cannot exceed 100 characters."],
    },
  },
  { _id: false }
);

const detectionSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: [true, "Complaint ID is required."],
    },
    modelName: {
      type: String,
      required: [true, "Model name is required."],
      trim: true,
      maxlength: [150, "Model name cannot exceed 150 characters."],
    },
    detected: {
      type: Boolean,
      required: [true, "Detected flag is required."],
    },
    confidence: {
      type: Number,
      required: [true, "Confidence score is required."],
      min: [0, "Confidence cannot be less than 0."],
      max: [1, "Confidence cannot exceed 1."],
    },
    boundingBoxes: {
      type: [boundingBoxSchema],
      default: [],
    },
    rawResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

detectionSchema.index({ complaintId: 1 });
detectionSchema.index({ detected: 1, confidence: -1 });

const Detection =
  mongoose.models.Detection || mongoose.model("Detection", detectionSchema);

export default Detection;
