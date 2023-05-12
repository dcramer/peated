import { Bottle } from '../types'

export default ({ bottle }: { bottle: Bottle }) => {
  return (
    <>
      {bottle.brand.name} {bottle.name}
    </>
  )
}
