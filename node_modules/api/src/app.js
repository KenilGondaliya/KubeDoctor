import express from 'express';
import cors from 'cors';
import helmet from 'helmet'; 
import morgan from 'morgan';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "kubedoctor-api",
    message: "API is healthy"
  })
})

export default app;