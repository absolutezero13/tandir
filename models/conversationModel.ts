import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema({
  matchId: {
    type: String,
    required: [true, "matchid is required."],
    unique: true,
  },
  messages: {
    type: [
      {
        message: String,
        from: String,
        to: String,
        createdAt: Date,
        order: Number,
      },
    ],
  },
});

type Message = {
  message: string;
  from: string;
  to: string;
  createdAt: Date;
  order: number;
};

export interface Conversation {
  matchId: string;
  messages: Message;
}

const Conversation = mongoose.model("Conversation", ConversationSchema);

export default Conversation;
