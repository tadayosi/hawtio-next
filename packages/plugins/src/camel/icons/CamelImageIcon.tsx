type CamelImageIconProps = {
  name: string
  svg: string
  size: number
} & typeof defaultImageIconProps

const defaultImageIconProps = {
  size: 16,
}

const CamelImageIcon = (props: CamelImageIconProps) => {
  return <img src={props.svg} width={props.size + 'px'} height={props.size + 'px'} alt={props.name} />
}

CamelImageIcon.defaultProps = defaultImageIconProps

export { CamelImageIcon }
