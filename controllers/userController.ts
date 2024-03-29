import { Request, Response } from "express";
import User, { IUser } from "../models/userModel";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { s3 } from "../aws/s3";
import crypto from "crypto";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const signUp = async (req: Request, res: Response) => {
  try {
    const newUserInfo: IUser = req.body;

    newUserInfo.password = await bcrypt.hash(newUserInfo.password, 10);

    const newUser = await User.create(newUserInfo);
    res.status(201).json({
      status: "success",
      data: newUser,
    });
  } catch (err) {
    console.log("err", err);
    res.status(400).json({
      status: "fail",
      message: err,
    });
  }
};

export const uploadImages = async (req: Request, res: Response) => {
  try {
    if (!req.files) {
      res.status(400).json({
        message: "no files provided!",
      });
      return;
    }

    const userId = req.params.id;

    for (const file of req?.files as Express.Multer.File[]) {
      const imageName = file.originalname + "-" + crypto.randomUUID();

      const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: imageName,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      const imageObj = new PutObjectCommand(params);

      await s3.send(imageObj);

      await User.updateOne(
        {
          _id: userId,
        },
        {
          $push: { pictures: { image: imageName, order: 0 } },
        }
      );
    }

    res.send({
      success: true,
      data: {
        message: "Images Uploaded",
      },
    });
  } catch (error) {
    console.log(error);
    res.send({
      success: false,
      error,
    });
  }
};

export const deleteImage = async (req: Request, res: Response) => {
  const imageName = req.params.imageName;

  const deleteCommand = new DeleteObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: imageName,
  });

  if (!imageName) {
    res.status(400).json({
      status: "fail",
      message: "No Image name provided",
    });
    return;
  }

  try {
    await s3.send(deleteCommand);
    await User.updateOne(
      {
        _id: req.params.id,
      },
      {
        $pull: {
          pictures: {
            image: imageName,
          },
        },
      }
    );

    res.send({
      success: true,
      data: {
        message: "Image Deleted " + imageName,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error,
    });
  }
};

export const getUserImages = async (req: Request, res: Response) => {
  try {
    const user: IUser | null = await User.findById(req.params.id);

    const images = [];

    if (!user) {
      return res.status(404).json({
        message: "no such user!",
      });
    }

    for (const imageObj of user?.pictures) {
      const getObjParams = {
        Bucket: process.env.BUCKET_NAME as string,
        Key: imageObj.image,
      };

      const command = new GetObjectCommand(getObjParams);

      const imageUrl = await getSignedUrl(s3, command, {
        expiresIn: 36000,
      });

      images.push({ imageUrl, imageName: imageObj.image });
    }

    res.status(200).json({
      status: "success",
      images,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error,
    });
  }
};

export const isUnique = async (req: Request, res: Response) => {
  const { fieldName, value } = req.body;

  try {
    const fieldData = await User.findOne({ [fieldName]: value });

    if (!fieldData) {
      res.status(200).json({
        status: "success",
        isUnique: true,
      });
    } else {
      res.status(200).json({
        status: "success",
        isUnique: false,
      });
    }
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: "No Image name provided",
    });
  }
};

export const signIn = async (req: Request, res: Response) => {
  try {
    const userInfo: {
      username: string;
      password: string;
    } = req.body;

    const user = (await User.findOne({ username: userInfo.username })) as IUser;

    if (!user) {
      res.status(401).json({
        status: "fail",
        message: "Yanlış kullanıcı adı ya da şifre.",
      });

      return;
    }

    const isMatch = await bcrypt.compare(userInfo.password, user.password);

    if (!isMatch) {
      res.status(400).json({
        status: "fail",
        message: "Yanlış kullanıcı adı ya da şifre.",
      });
      return;
    }
    console.log("success!!");
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        phoneNumber: user.phoneNumber,
      },
      "secret"
    );

    delete user.password;

    res.status(200).json({
      data: {
        token,
        user,
      },
    });
  } catch (error) {
    res.status(400).json({
      message: "fail",
      error,
    });
  }
};

export const signInWithToken = async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      data: {
        user: req.body.user,
      },
    });
  } catch (error) {
    res.status(400).send({
      error,
    });
  }
};

export const getAllAvailableUsers = async (req: Request, res: Response) => {
  try {
    const currentUser: IUser = req.body.user;

    // LIKE-DISLIKE-USER ITSELF
    const likeAndDislikes = [...currentUser.likes, ...currentUser.dislikes];
    const self = currentUser._id;
    const allFilters = [...likeAndDislikes, self];

    // AGE FILTER
    const MS_IN_A_YEAR = 31536000000;
    const TODAY_IN_MS = new Date().getTime();
    const minMs = TODAY_IN_MS - currentUser.preferences.ages.max * MS_IN_A_YEAR;
    const maxMs = TODAY_IN_MS - currentUser.preferences.ages.min * MS_IN_A_YEAR;

    // LOCATION
    const EARTH_RADIUS = 6378.1;

    const locationQuery = {
      geometry: {
        $geoWithin: {
          $centerSphere: [
            [
              currentUser.geometry.coordinates[0],
              currentUser.geometry.coordinates[1],
            ],
            currentUser.preferences.distance / EARTH_RADIUS,
          ],
        },
      },
    };

    const usersQuery = User.find({
      _id: { $nin: allFilters },
    })
      .find(locationQuery)
      .find({
        birthDateInMs: { $gte: minMs, $lte: maxMs },
      })
      .limit(20)
      .select("-password");

    let users;

    // GENDER FILTER
    if (currentUser.preferences.gender === "all") {
      users = await usersQuery;
    } else {
      users = await usersQuery.find({
        gender: { $eq: currentUser.preferences.gender },
      });
    }

    res.status(200).json({
      count: users.length,
      data: users,
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err,
    });
  }
};
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const updatedUser = req.body;

    const user = await User.findByIdAndUpdate(userId, updatedUser, {
      new: true,
      runValidators: true,
    });

    const { password, ...userWithoutPassword } = user.toObject();

    res.status(200).json({
      data: userWithoutPassword,
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      err,
      message: "some Error occured",
    });
  }
};

export const getUser = async (req: Request, res: Response) => {
  try {
    const user: IUser | null = await User.findById(req.params.id);

    res.status(200).json({
      data: user,
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err,
    });
  }
};

export const getMultipleUsers = async (req: Request, res: Response) => {
  try {
    const ids = req.body.userIds;

    const users = await User.find({
      _id: { $in: ids },
    }).select("-password");

    res.status(200).json({
      data: users,
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err,
    });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    res.status(204).json({
      data: user,
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      message: err,
    });
  }
};
