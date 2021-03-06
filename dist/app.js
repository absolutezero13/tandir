"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const userRouter_1 = __importDefault(require("./routers/userRouter"));
const bookingRouter_1 = __importDefault(require("./routers/bookingRouter"));
const app = (0, express_1.default)();
dotenv_1.default.config();
const DB = (_a = process.env.DB) === null || _a === void 0 ? void 0 : _a.replace("<PASSWORD>", process.env.DBPASSWORD);
mongoose_1.default
    .connect(DB)
    .then((con) => {
    console.log("Connected to MongoDB");
})
    .catch((err) => {
    console.log(err);
});
dotenv_1.default.config({ path: "./.env" });
app.use(express_1.default.json());
app.use(express_1.default.static("public"));
app.use("/users", userRouter_1.default);
app.use("/bookings", bookingRouter_1.default);
app.listen(process.env.PORT);
