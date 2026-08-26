import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken
} from "./auth.utils.js";

import { db } from "../../database/postgres.js";


export async function registerUser({
  email,
  password,
  workspaceName
}) {
  const existingUser = await db.query(
    `
    SELECT id
    FROM users
    WHERE email = $1
    `,
    [email]
  );

  if (existingUser.rows.length > 0) {
    const error = new Error(
      "User with this email already exists"
    );

    error.statusCode = 409;

    throw error;
  }


  const passwordHash =
    await hashPassword(password);


  const client = await db.connect();

  try {
    await client.query("BEGIN");


    const userResult = await client.query(
      `
      INSERT INTO users (
        email,
        password_hash
      )
      VALUES ($1, $2)
      RETURNING id, email, created_at
      `,
      [
        email,
        passwordHash
      ]
    );


    const user = userResult.rows[0];


    const workspaceResult =
      await client.query(
        `
        INSERT INTO workspaces (
          name
        )
        VALUES ($1)
        RETURNING id, name, created_at
        `,
        [
          workspaceName ||
          `${email}'s Workspace`
        ]
      );


    const workspace =
      workspaceResult.rows[0];


    await client.query(
      `
      INSERT INTO workspace_members (
        workspace_id,
        user_id,
        role
      )
      VALUES ($1, $2, $3)
      `,
      [
        workspace.id,
        user.id,
        "Owner"
      ]
    );


    await client.query("COMMIT");


    const accessToken =
      generateAccessToken(user);

    const refreshToken =
      generateRefreshToken(user);


    return {
      user: {
        id: user.id,
        email: user.email
      },

      workspace: {
        id: workspace.id,
        name: workspace.name
      },

      accessToken,
      refreshToken
    };

  } catch (error) {

    await client.query("ROLLBACK");

    throw error;

  } finally {

    client.release();

  }
}


export async function loginUser({
  email,
  password
}) {

  const result = await db.query(
    `
    SELECT
      id,
      email,
      password_hash
    FROM users
    WHERE email = $1
    `,
    [email]
  );


  if (result.rows.length === 0) {

    const error = new Error(
      "Invalid email or password"
    );

    error.statusCode = 401;

    throw error;
  }


  const user = result.rows[0];


  const validPassword =
    await comparePassword(
      password,
      user.password_hash
    );


  if (!validPassword) {

    const error = new Error(
      "Invalid email or password"
    );

    error.statusCode = 401;

    throw error;
  }


  const accessToken =
    generateAccessToken(user);

  const refreshToken =
    generateRefreshToken(user);


  return {
    user: {
      id: user.id,
      email: user.email
    },

    accessToken,

    refreshToken
  };
}