import express from "express";
import {
  deleteUser,
  getAllUsers,
  getUser,
  signIn,
  signUp,
  updateUser,
} from "../controllers/userController";

const router = express.Router();

router.post("/signup", signUp);
router.post("/signin", signIn);
router.route("/").get(getAllUsers);
router.route("/:id").get(getUser).delete(deleteUser).patch(updateUser);

export default router;
