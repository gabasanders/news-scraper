import { useEffect, useState, useMemo } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Select from 'react-select'

// To automatically update when saving in WSL, run:
// export CHOKIDAR_USEPOLLING=true

function App() {
  const [articles, setArticles] = useState([])
  const [selectedKeywords, selectKeywords] = useState([])
  const [selectedArticles, setSelectedArticles] = useState([...articles])

  const allKeywords = useMemo(() => {
    const keywordsSet = new Set()
    articles.forEach(article => {
      if (Array.isArray(article.keywords)) {
        article.keywords.forEach(kw => keywordsSet.add(kw))
      }
    })
    return Array.from(keywordsSet)
  }, [articles])

  const selectOptions = allKeywords.map(kw => ({value:kw, label:kw}))

  useEffect(() => {

    const fecthNews = async () => {

      const response = await fetch('http://localhost:3002/api/news');

      const data = await response.json();

      console.log(data);

      setArticles(data);
    }

    fecthNews();

  }, []);


  useEffect(() => {

    if (selectedKeywords.length == 0) {
      setSelectedArticles(articles);
    }
    else{
      // For each article, verify if any of the article's keywords is inclusided in selected 
      setSelectedArticles(articles.filter(el => el.keywords.some(k => selectedKeywords.includes(k))))
    }


  },[articles, selectedKeywords])

  function formatDate(rawDate){

    const d = rawDate.slice(0,10);

    return d
  }

  function handleSelectKeyword(options){

    const values = options ? options.map(o => o.value) : []

      selectKeywords(values);
  }

  return(
    <div>
      <h1>News Articles</h1>

      <Select options={selectOptions} isMulti placeholder='Filter keywords'
      onChange={handleSelectKeyword} value={selectOptions.filter(o => selectedKeywords.includes(o.value))}></Select>

      <div class='news-container'>
      {articles.length == 0 
      ? (<p>No articles so far</p>)
      : (selectedArticles.sort((a,b) => new Date(b.pub_date) - new Date(a.pub_date))
      .slice(0,50)
      .map(el =>
          <div class="card">
                <div class='keyword-container'>
                  {
                    el.keywords.map(word => (<p class='keyword'>{word}</p>))
                  }
                </div>

                <p class="card-title">{el.title}</p>
                <p class="small-desc">
                    {el.news_desc}
                </p>
                <div class="meta-data">
                    <p>Source:{el.source}</p>
                    <p>Publication Date: {formatDate(el.pub_date)}</p>
                </div>
                <a class="go-corner" target='_blank' href={el.url}>
                  <div class="go-arrow">→</div>
                </a>
              </div>
      ))}
      </div>

    </div>
  )

};

export default App;
