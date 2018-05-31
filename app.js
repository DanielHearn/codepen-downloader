const args = process.argv.slice(2)
if (args.length === 1) {
  const username = args[0]
  console.log(`Check if ${username} exists`)
}
