# Flappy Floyd

### Development:
- Start a a test webserver with `bun run dev`
- Configure the local site to use a custom backend server by setting `flappy-floyd.server` in the browser console.
 - Format: `localStorage.setItem("flappy-floyd.server", "<protocol-(ws/wss)>://<server-address>:<server-port>")`
 - For example: `localStorage.setItem("flappy-floyd.server", "ws://localhost:420")`

### Licensing:
This project is licensed under the [The GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0)
license. For more information, see the [LICENSE](./LICENSE) file located within the project root directory.

**Note:** As of the current moment, all files, except the contents of standalone.js,
which was heavily adapted from the original code contained within the base repo have been
agreed to be fully relicensed to the GPL 3.0 by all contributors.
