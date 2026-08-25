import z from "zod"

class ValidationMiddleware {
  validate(schema) {
    return (req, res, next) => {
      try {
        // Validate body
        if (schema.body) {
          req.body = schema.body.parse(req.body);
        }
        
        // Validate query
        if (schema.query) {
          req.query = schema.query.parse(req.query);
        }
        
        // Validate params
        if (schema.params) {
          req.params = schema.params.parse(req.params);
        }
        
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: 'Validation failed',
            details: error.errors
          });
        }
        next(error);
      }
    };
  }

  // Common schemas
  schemas = {
    register: z.object({
      username: z.string().min(3).max(50),
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(['VIEWER', 'DEVELOPER', 'OPERATOR', 'ADMIN']).optional()
    }),
    
    login: z.object({
      username: z.string().min(1),
      password: z.string().min(1)
    }),
    
    refresh: z.object({
      refreshToken: z.string().min(1)
    }),
    
    incidentStatus: z.object({
      status: z.enum([
        'DETECTED', 'INVESTIGATING', 'DIAGNOSED', 'RECOMMENDED',
        'WAITING_APPROVAL', 'REMEDIATING', 'VERIFYING', 'RESOLVED', 'FAILED'
      ])
    }),
    
    cluster: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      kubeconfig: z.string().min(1),
      context: z.string().optional()
    }),
    
    incidentNote: z.object({
      content: z.string().min(1)
    })
  };
}

module.exports = new ValidationMiddleware();