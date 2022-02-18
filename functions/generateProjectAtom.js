const { builder } = require("@netlify/functions")
const { Feed } = require('feed')
const { got } = require('got')

const hackadayKey = process.env.hackadayKey

async function handler(event, context, opts = {}) {

  const [, , projectID] = event.path.split('/')

  if (!projectID) {
    return {
      statusCode: 404,
      body: 'Not Found',
    };
  }

  let project = await got(`https://api.hackaday.io/v1/projects/${projectID}?api_key=${hackadayKey}`, {responseType: 'json'})
  .catch((error) => {
    console.error(`Error ${error?.response?.statusCode || ''} fetching project id [${projectID}] from Hackaday.`)
  })

  if (!project?.body?.name) {
    return {
      // Netlify on-demand builders have to return 200??
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
      },      
      body: `Error fetching project from Hackaday.`,
      ttl: 3600
    };
  }

  let projectLogs = await got(`https://api.hackaday.io/v1/projects/${projectID}/logs?api_key=${hackadayKey}`, {responseType: 'json'})
  
  const feed = new Feed({
    title: `[Hackaday] ${project.body.name}`,
    description: project.body.summary,
    id: project.body.url,
    link: project.body.url,
    image: project.body.image_url,
    updated: new Date(project.body.updated*1000),
    generator: 'Hackaday-RSS - https://hackaday-rss.zackboe.hm - https://github.com/zackboe/hackaday-rss'
  })
  
  feed.items = await Promise.all(projectLogs.body.logs.map(async (log) => {
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

  console.log(`Served project ${project.body.id} with ${feed.items.length} entries - [UA:${event.headers['user-agent']}]`)

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/atom+xml',
      'Content-Disposition': `attachment; filename="Hackaday_${project.body.id}.atom"`
    },
    body: feed.atom1(),
    ttl: 21600,
  };
}

exports.handler = builder(handler);
