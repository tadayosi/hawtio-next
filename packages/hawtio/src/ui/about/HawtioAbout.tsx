import imgLogoB64 from '@hawtiosrc/img/hawtio-logo.svg'
import { stringSorter } from '@hawtiosrc/util/strings'
import { AboutModal, Content } from '@patternfly/react-core'
import React from 'react'
import { useAbout } from './context'
import { log } from './globals'
import { hawtio, type AboutProductInfo as AboutProductInfoType, type AboutConfig } from '@hawtiosrc/core'
import './HawtioAbout.css'

const imgLogo = `data:image/svg+xml;base64,${imgLogoB64}`

const AboutProductInfo: React.FunctionComponent<{
  productInfo: AboutProductInfoType[]
}> = ({ productInfo }) => (
  <Content id='hawtio-about-product-info'>
    <Content component='h3'>Component versions</Content>
    <Content component='dl'>
      {productInfo.map(({ name, value }, index) => (
        <React.Fragment key={`product-info-${index}`}>
          <Content component='dt'>{name}</Content>
          <Content component='dd'>{value}</Content>
        </React.Fragment>
      ))}
    </Content>
  </Content>
)

const AboutDescription: React.FunctionComponent<{
  about: AboutConfig
}> = ({ about }) => {
  if (about.description) {
    return (
      <Content id='hawtio-about-description'>
        <Content component='p'>{about.description}</Content>
      </Content>
    )
  }
  return null
}

export const HawtioAbout: React.FunctionComponent<{
  isOpen: boolean
  onClose: () => void
}> = ({ isOpen, onClose }) => {
  const { about, aboutLoaded } = useAbout()

  if (!aboutLoaded) {
    return null
  }

  let imgSrc = about.imgSrc || imgLogo
  let backgroundImgSrc = about.backgroundImgSrc
  if (hawtio.windowTheme() === 'dark') {
    imgSrc = about.imgDarkModeSrc || imgLogo
    backgroundImgSrc = about.backgroundDarkModeImgSrc || backgroundImgSrc
  }
  const title = about.title || 'Hawtio Management Console'
  const copyright = about.copyright || '© Hawtio project'

  const productInfo = about.productInfo || []
  productInfo.sort((a, b) => stringSorter(a.name, b.name))
  log.debug('Product info:', productInfo)

  return (
    <AboutModal
      isOpen={isOpen}
      onClose={onClose}
      productName={title}
      brandImageSrc={imgSrc}
      backgroundImageSrc={backgroundImgSrc}
      brandImageAlt={title}
      trademark={copyright}
    >
      <AboutDescription about={about} />
      <AboutProductInfo productInfo={productInfo} />
    </AboutModal>
  )
}
