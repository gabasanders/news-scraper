import cors from 'cors';
import express from 'express';
import { getNews } from './db/db.js';

const app = express();
const PORT = 3002;


app.use(cors());
app.use(express.json()); // Middleware para parsear JSON (não estritamente necessário para este GET, mas bom ter)


app.get('/api/news', async (req,res) => {

    const articles = await getNews();

    console.log('Fetched articles:', articles.length);

    res.json(articles);
});


app.listen(PORT, () => {
    console.log(`Server running on Port ${PORT}`);
});

 



