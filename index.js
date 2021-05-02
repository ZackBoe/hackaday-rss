require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT || 3000
const { Feed } = require('feed')
const got = require('got')

const hackadayKey = process.env.hackadayKey

app.get('/project/:projectID', async (req, res) => {
  let project = await got(`https://api.hackaday.io/v1/projects/${req.params.projectID}?api_key=${hackadayKey}`, {responseType: 'json'})
  let projectLogs = await got(`https://api.hackaday.io/v1/projects/${req.params.projectID}/logs?api_key=${hackadayKey}`, {responseType: 'json'})

  const feed = new Feed({
    title: `Hackaday ${project.body.name}`,
    description: project.body.summary,
    id: project.body.url,
    link: project.body.url,
    image: project.body.image_url,
    updated: new Date(project.body.updated*1000)
  })

  const items = await Promise.all(projectLogs.body.logs.map(async (log) => {
    let author = await got(`https://api.hackaday.io/v1/users/${log.user_id}?api_key=${hackadayKey}`, {responseType: 'json'})
    return {
      title: log.title,
      id: `https://hackaday.io/project/${project.body.id}/log/${log.id}`,
      link: `https://hackaday.io/project/${project.body.id}/log/${log.id}`,
      content: log.body,
      date: new Date(log.created*1000),
      author: [
        {
          name: author.body.screen_name,
          link: author.body.url
        }
      ]
    }
  }))

  feed.items = items

  res.set('Content-Type', 'application/atom+xml');
  res.set('Content-Disposition', `attachment; filename="Hackaday_${project.id}"`)
  res.send(feed.atom1())

})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
