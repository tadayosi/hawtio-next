/* eslint-disable @typescript-eslint/no-var-requires */
/* jshint node: true */
const fs = require('fs')
const path = require('path')

const ROOT = '..'
const svgdir = path.resolve(__dirname, ROOT, 'src', 'plugins', 'camel', 'icons', 'svg')
const index = path.resolve(svgdir, 'index.ts')

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function safeSvgName(name) {
  let iname = name.replace('.svg', '') // Remove svg file extension
  iname = iname.replace('24', '') // Remove 24 suffix
  iname = iname.replace('-icon', '') // Remove any -icon suffix
  iname = iname.replace('icon', '') // Remove remaining icon suffix
  iname = iname.replace(/-([a-z])/g, g => {
    return g[1].toUpperCase()
  })
  iname = iname.charAt(0).toLowerCase() + iname.slice(1) // Lower-case the first letter
  return iname
}

async function generateContents(svgPath, prefix) {
  const impContent = []
  const expContent = []
  const expNames = []
  const names = []

  const dir = await fs.promises.opendir(svgPath)
  for await (const ent of dir) {
    if (ent.isDirectory()) {
      const contents = await generateContents(path.resolve(svgPath, ent.name), ent.name)
      impContent.push(...contents[0])
      expContent.push(...contents[1])
      expNames.push(...contents[2])
    }

    if (!ent.name.endsWith('.svg')) {
      continue
    }

    let name = safeSvgName((prefix ? prefix : '') + capitalize(ent.name))
    let relativePath = (prefix ? prefix + '/' : '') + ent.name

    impContent.push(`import ${name} from './${relativePath}'`)
    names.push(name)
  }

  // Sort the imports into alphabetical order
  impContent.sort()

  // Generate the export list
  for (let i = 0; i < names.length; ++i) {
    expContent.push(`  ${names[i]},`)
  }

  expContent.sort()
  return [impContent, expContent, names]
}

async function writeToIndex(svgpath, idx) {
  fs.writeFileSync(idx, '// === AUTO-GENERATED WITH generate-camel-svg-index.js ===\n\n', { flag: 'a+' })

  const contents = await generateContents(svgpath)
  const impContent = contents[0]
  const expContent = contents[1]
  const expNames = contents[2]

  //
  // Write out the imports of the svg files
  //
  for (const imp of impContent) {
    fs.writeFileSync(idx, imp + '\n', { flag: 'a+' })
  }

  //
  // Write out an enum of the export names
  //
  fs.writeFileSync(idx, '\nenum IconNames {\n', { flag: 'a+' })
  for (const name of expNames) {
    const iconName = name[0].toUpperCase() + name.substr(1) + 'Icon'
    fs.writeFileSync(idx, `  ${iconName} = '${iconName}',\n`, { flag: 'a+' })
  }
  fs.writeFileSync(idx, '}\n', { flag: 'a+' })

  //
  // Write out the exports of the svg names starting with the enum
  //
  fs.writeFileSync(idx, '\nexport {\n', { flag: 'a+' })
  fs.writeFileSync(idx, '  IconNames,\n', { flag: 'a+' })

  for (const exp of expContent) {
    fs.writeFileSync(idx, exp + '\n', { flag: 'a+' })
  }

  fs.writeFileSync(idx, '}\n', { flag: 'a+' })
}

if (!fs.existsSync(svgdir)) {
  console.error(`${svgdir} does not exist. Exiting`)
  process.exit(1)
}

// Remove existing file
if (fs.existsSync(index)) {
  fs.unlinkSync(index)
}

writeToIndex(svgdir, index).catch(console.error)
