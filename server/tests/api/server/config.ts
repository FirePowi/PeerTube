/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
import { About } from '../../../../shared/models/server/about.model'
import { CustomConfig } from '../../../../shared/models/server/custom-config.model'
import { deleteCustomConfig, getAbout, killallServers, makeHTMLRequest, reRunServer } from '../../utils'
const expect = chai.expect

import {
  getConfig,
  flushTests,
  runServer,
  registerUser, getCustomConfig, setAccessTokensToServers, updateCustomConfig
} from '../../utils/index'

function checkInitialConfig (data: CustomConfig) {
  expect(data.instance.name).to.equal('PeerTube')
  expect(data.instance.shortDescription).to.equal(
    'PeerTube, a federated (ActivityPub) video streaming platform using P2P (BitTorrent) directly in the web browser ' +
    'with WebTorrent and Angular.'
  )
  expect(data.instance.description).to.equal('Welcome to this PeerTube instance!')
  expect(data.instance.terms).to.equal('No terms for now.')
  expect(data.instance.defaultClientRoute).to.equal('/videos/trending')
  expect(data.instance.defaultNSFWPolicy).to.equal('display')
  expect(data.instance.customizations.css).to.be.empty
  expect(data.instance.customizations.javascript).to.be.empty
  expect(data.services.twitter.username).to.equal('@Chocobozzz')
  expect(data.services.twitter.whitelisted).to.be.false
  expect(data.cache.previews.size).to.equal(1)
  expect(data.cache.captions.size).to.equal(1)
  expect(data.signup.enabled).to.be.true
  expect(data.signup.limit).to.equal(4)
  expect(data.admin.email).to.equal('admin1@example.com')
  expect(data.user.videoQuota).to.equal(5242880)
  expect(data.transcoding.enabled).to.be.false
  expect(data.transcoding.threads).to.equal(2)
  expect(data.transcoding.resolutions['240p']).to.be.true
  expect(data.transcoding.resolutions['360p']).to.be.true
  expect(data.transcoding.resolutions['480p']).to.be.true
  expect(data.transcoding.resolutions['720p']).to.be.true
  expect(data.transcoding.resolutions['1080p']).to.be.true
}

function checkUpdatedConfig (data: CustomConfig) {
  expect(data.instance.name).to.equal('PeerTube updated')
  expect(data.instance.shortDescription).to.equal('my short description')
  expect(data.instance.description).to.equal('my super description')
  expect(data.instance.terms).to.equal('my super terms')
  expect(data.instance.defaultClientRoute).to.equal('/videos/recently-added')
  expect(data.instance.defaultNSFWPolicy).to.equal('blur')
  expect(data.instance.customizations.javascript).to.equal('alert("coucou")')
  expect(data.instance.customizations.css).to.equal('body { background-color: red; }')
  expect(data.services.twitter.username).to.equal('@Kuja')
  expect(data.services.twitter.whitelisted).to.be.true
  expect(data.cache.previews.size).to.equal(2)
  expect(data.cache.captions.size).to.equal(3)
  expect(data.signup.enabled).to.be.false
  expect(data.signup.limit).to.equal(5)
  expect(data.admin.email).to.equal('superadmin1@example.com')
  expect(data.user.videoQuota).to.equal(5242881)
  expect(data.transcoding.enabled).to.be.true
  expect(data.transcoding.threads).to.equal(1)
  expect(data.transcoding.resolutions['240p']).to.be.false
  expect(data.transcoding.resolutions['360p']).to.be.true
  expect(data.transcoding.resolutions['480p']).to.be.true
  expect(data.transcoding.resolutions['720p']).to.be.false
  expect(data.transcoding.resolutions['1080p']).to.be.false
}

function checkIndexTags (html: string, title: string, description: string, css: string) {
  expect(html).to.contain('<title>' + title + '</title>')
  expect(html).to.contain('<meta name="description" content="' + description + '" />')
  expect(html).to.contain('<style class="custom-css-style">' + css + '</style>')
}

describe('Test config', function () {
  let server = null

  before(async function () {
    this.timeout(30000)

    await flushTests()
    server = await runServer(1)
    await setAccessTokensToServers([ server ])
  })

  it('Should have a correct config on a server with registration enabled', async function () {
    const res = await getConfig(server.url)
    const data = res.body

    expect(data.signup.allowed).to.be.true
  })

  it('Should have a correct config on a server with registration enabled and a users limit', async function () {
    this.timeout(5000)

    await Promise.all([
      registerUser(server.url, 'user1', 'super password'),
      registerUser(server.url, 'user2', 'super password'),
      registerUser(server.url, 'user3', 'super password')
    ])

    const res = await getConfig(server.url)
    const data = res.body

    expect(data.signup.allowed).to.be.false
  })

  it('Should get the customized configuration', async function () {
    const res = await getCustomConfig(server.url, server.accessToken)
    const data = res.body as CustomConfig

    checkInitialConfig(data)
  })

  it('Should have valid index html tags (title, description...)', async function () {
    const res = await makeHTMLRequest(server.url, '/videos/trending')

    const description = 'PeerTube, a federated (ActivityPub) video streaming platform using P2P (BitTorrent) directly in the web browser ' +
      'with WebTorrent and Angular.'
    checkIndexTags(res.text, 'PeerTube', description, '')
  })

  it('Should update the customized configuration', async function () {
    const newCustomConfig: CustomConfig = {
      instance: {
        name: 'PeerTube updated',
        shortDescription: 'my short description',
        description: 'my super description',
        terms: 'my super terms',
        defaultClientRoute: '/videos/recently-added',
        defaultNSFWPolicy: 'blur' as 'blur',
        customizations: {
          javascript: 'alert("coucou")',
          css: 'body { background-color: red; }'
        }
      },
      services: {
        twitter: {
          username: '@Kuja',
          whitelisted: true
        }
      },
      cache: {
        previews: {
          size: 2
        },
        captions: {
          size: 3
        }
      },
      signup: {
        enabled: false,
        limit: 5
      },
      admin: {
        email: 'superadmin1@example.com'
      },
      user: {
        videoQuota: 5242881
      },
      transcoding: {
        enabled: true,
        threads: 1,
        resolutions: {
          '240p': false,
          '360p': true,
          '480p': true,
          '720p': false,
          '1080p': false
        }
      }
    }
    await updateCustomConfig(server.url, server.accessToken, newCustomConfig)

    const res = await getCustomConfig(server.url, server.accessToken)
    const data = res.body

    checkUpdatedConfig(data)
  })

  it('Should have valid index html updated tags (title, description...)', async function () {
    const res = await makeHTMLRequest(server.url, '/videos/trending')

    checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }')
  })

  it('Should have the configuration updated after a restart', async function () {
    this.timeout(10000)

    killallServers([ server ])

    await reRunServer(server)

    const res = await getCustomConfig(server.url, server.accessToken)
    const data = res.body

    checkUpdatedConfig(data)

    // Check HTML too
    const resHtml = await makeHTMLRequest(server.url, '/videos/trending')
    checkIndexTags(resHtml.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }')
  })

  it('Should fetch the about information', async function () {
    const res = await getAbout(server.url)
    const data: About = res.body

    expect(data.instance.name).to.equal('PeerTube updated')
    expect(data.instance.shortDescription).to.equal('my short description')
    expect(data.instance.description).to.equal('my super description')
    expect(data.instance.terms).to.equal('my super terms')
  })

  it('Should remove the custom configuration', async function () {
    this.timeout(10000)

    await deleteCustomConfig(server.url, server.accessToken)

    const res = await getCustomConfig(server.url, server.accessToken)
    const data = res.body

    checkInitialConfig(data)
  })

  after(async function () {
    killallServers([ server ])
  })
})
