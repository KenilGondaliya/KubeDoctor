import jwt from 'jsonwebtoken'
import User from '../models/User'
import logger from '../utils/logger'

class AuthController {
  async register(req, res) {
    try {
      const { username, email, password, role } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        return res.status(400).json({
          error: 'User with this email or username already exists'
        });
      }

      // Create user
      const user = new User({
        username,
        email,
        password,
        role: role || 'VIEWER'
      });

      await user.save();

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      user.refreshToken = refreshToken;
      await user.save();

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        tokens: {
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  async login(req, res) {
    try {
      const { username, password } = req.body;

      // Find user
      const user = await User.findOne({ 
        $or: [{ username }, { email: username }],
        isActive: true
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      user.lastLogin = new Date();
      
      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      user.refreshToken = refreshToken;
      await user.save();

      res.json({
        message: 'Login successful',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.getPermissions()
        },
        tokens: {
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      
      const user = await User.findById(decoded.id);
      if (!user || user.refreshToken !== refreshToken) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user);

      res.json({
        accessToken
      });
    } catch (error) {
      logger.error('Refresh error:', error);
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }

  async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (refreshToken) {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        await User.findByIdAndUpdate(decoded.id, { refreshToken: null });
      }

      res.json({ message: 'Logout successful' });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  async me(req, res) {
    try {
      const user = await User.findById(req.user.id)
        .select('-password -refreshToken');
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        user: {
          ...user.toObject(),
          permissions: user.getPermissions()
        }
      });
    } catch (error) {
      logger.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  }

  generateAccessToken(user) {
    return jwt.sign(
      { 
        id: user._id,
        username: user.username,
        role: user.role,
        permissions: user.getPermissions()
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  generateRefreshToken(user) {
    return jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
  }
}

module.exports = new AuthController();