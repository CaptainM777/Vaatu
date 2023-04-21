const Eris = require("eris");
const { token, name, prefix } = require("./config.json");
const embedColors = require("./embed_colors.js")
const commands = Object.values(require("./commands.js"));
const helpListCommands = commands.map((command) => `\`${prefix}${command.label}\` — ${command.description}`);

const bot = new Eris.CommandClient(token, {}, {
  name: name,
  prefix: prefix,
  defaultHelpCommand: false
});

bot.on("ready", () => {
  console.log("Ready!");
});

bot.on("error", (err) => {
  console.error(err);
});

for(command of commands) { bot.registerCommand(command.label, command.generator, command.options); }

bot.registerCommand("help", async (msg, args) => {
  const color = embedColors.normal;
  const footer = { text: `Requested by: ${msg.author.username}#${msg.author.discriminator}` };

  if(args.length === 0) {
    msg.channel.createMessage({
      embed: {
        color: color,
        author: { name: "Help: All Commands" },
        description: "To see more detailed information about a command, do `;help [command name]`.",
        fields: [ { name: "PM2 Process Management", value: helpListCommands.join("\n") } ],
        footer: footer
      }
    });
  } else {
    const commandName = args[0].toLowerCase();
    const command = commands.find((command) => command.label === commandName);

    if(command !== undefined) {
      msg.channel.createMessage({
        embed: {
          color: color, 
          author: { name: `Help: ${prefix}${commandName}` },
          description: "If a command argument is enclosed in square brackets ([ ]), then the argument is required. If it's enclosed " +
                       "in angle brackets (< >), then it's optional.",
          fields: command.fullDescriptionFields,
          footer: footer
        }
      });
    } else {
      msg.channel.createMessage({
        embed: {
          color: embedColors.error,
          author: { name: "Help" },
          description: `❌ Command \`${commandName}\` not found!`,
          footer: footer
        }
      });
    }
  }
});

bot.connect();
