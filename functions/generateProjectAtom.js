const { builder } = require("@netlify/functions")
const RSS = require('rss')
const fetch = require('node-fetch');

const hackadayKey = process.env.hackadayKey

async function handler(event, context, opts = {}) {

  const [, , projectID] = event.path.split('/')

  if (!projectID) {
    return {
      statusCode: 404,
      body: 'Not Found',
    };
  }

  let project = await fetch(`https://api.hackaday.io/v1/projects/${projectID}?api_key=${hackadayKey}`).then(res => res.json())
  .catch((error) => {
    console.error(`Error ${error?.response?.statusCode || ''} fetching project id [${projectID}] from Hackaday.`)
  })

  if (!project?.name) {
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

  let projectLogs = await fetch(`https://api.hackaday.io/v1/projects/${projectID}/logs?api_key=${hackadayKey}`).then(res => res.json())
  
  const feed = new RSS({
    title: `[Hackaday] ${project.name}`,
    description: project.summary,
    site_url: project.url,
    image_url: project.image_url,
    generator: 'Hackaday-RSS - https://hackaday-rss.zackboe.hm - https://github.com/zackboe/hackaday-rss'
  })
  
  await Promise.all(projectLogs.logs.map(async (log) => {
    let author = await fetch(`https://api.hackaday.io/v1/users/${log.user_id}?api_key=${hackadayKey}`).then(res => res.json())
    feed.item({
      title: log.title,
      guid: `https://hackaday.io/project/${project.id}/log/${log.id}`,
      url: `https://hackaday.io/project/${project.id}/log/${log.id}`,
      description: log.body,
      date: new Date(log.created*1000),
      author: author.screen_name
    })
  }))

  console.log(`Served project ${project.id} with ${feed.items.length} entries - [UA:${event.headers['user-agent']}]`)

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="Hackaday_${project.id}.xml"`
    },
    body: feed.xml(),
    ttl: 21600,
  };
}

exports.handler = builder(handler);
