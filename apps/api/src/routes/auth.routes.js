import express from "express"
import authController from '../controllers/authController'
import authMiddleware from '../middleware/auth'
import validation from '../middleware/validation'

const router = express.Router();

// Public routes
router.post(
  '/register',
  validation.validate({ body: validation.schemas.register }),
  authController.register.bind(authController)
);

router.post(
  '/login',
  validation.validate({ body: validation.schemas.login }),
  authController.login.bind(authController)
);

router.post(
  '/refresh',
  validation.validate({ body: validation.schemas.refresh }),
  authController.refresh.bind(authController)
);

router.post(
  '/logout',
  authController.logout.bind(authController)
);

// Protected routes
router.get(
  '/me',
  authMiddleware.authenticate.bind(authMiddleware),
  authController.me.bind(authController)
);

module.exports = router;