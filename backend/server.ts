import "dotenv/config";
import express from "express";
import authRoutes from "./src/routes/authRoute";
import adminRoutes from "./src/routes/adminRoute";
import { prisma } from "./src/utils/db";

const app = express();

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);

app.get("/api/users", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
