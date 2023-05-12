export default ({ children }: { children: any }) => {
  return (
    <div
      style={{
        flex: '1 1 auto',
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0,
        WebkitOverflowScrolling: 'touch', // iOS momentum scrolling
      }}
    >
      {children}
    </div>
  )
}
