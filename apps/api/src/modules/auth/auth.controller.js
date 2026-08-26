import { registerSchema, loginSchema } from "./auth.schema.js";

import { registerUser, loginUser } from "./auth.service.js";

export async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);

    const result = await registerUser(data);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);

    const result = await loginUser(data);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  res.json({
    success: true,

    data: {
      user: req.user,
    },
  });
}
