const { exec } = require("child_process");
const { promisify } = require('util');
const embedColors = require("./embed_colors.js");

const execute = async (channel, cmd) => {
  try {
    const promisifiedExec = promisify(exec);
    return await promisifiedExec(cmd);
  } catch(err) {
    channel.createMessage({
      embed: {
        color: embedColors.error,
        title: "Exec command failed! Details below:",
        description: `\`\`\`js\n${err}\`\`\``
      }
    });
  }
}

const formatExecOutput = (execOutput) => { 
  return execOutput.split("\n").filter(string => string.startsWith("[PM2]")).join("\n"); 
}

const sendErrorMessage = (channel, message) => {
  channel.createMessage({
    embed: { 
      color: embedColors.error, 
      description: `❌ ${message}` 
    } 
  }); 
}

// Copied from https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable-string
/**
 * Format bytes as human-readable text.
 * 
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use 
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 * 
 * @return Formatted string.
 */
const humanFileSize = (bytes, si=false, dp=1) => {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si 
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] 
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10**dp;

  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


  return bytes.toFixed(dp) + ' ' + units[u];
}

// Commands

const restart = async (msg, args) => {
  const process_name_or_id = args.join(" ");

  let execResult = await execute(msg.channel, `pm2 restart ${process_name_or_id}`);
  
  if(execResult !== undefined) {
    execResult = formatExecOutput(execResult.stdout);

    console.log(`Restarting process ${process_name_or_id}...`);

    msg.channel.createMessage({
      embed: {
        color: embedColors.success,
        title: `Restart successful!`,
        description: `\`\`\`js\n${execResult}\`\`\``
      }
    });
  }
}

const stop = async (msg, args) => { 
  const process_name_or_id = args.join(" ");

  let execResult = await execute(msg.channel, `pm2 stop ${process_name_or_id}`);
  
  if(execResult !== undefined) {
    execResult = formatExecOutput(execResult.stdout);

    console.log(`Stopping process ${process_name_or_id}...`);

    msg.channel.createMessage({
      embed: {
        color: embedColors.success,
        title: `Stop successful!`,
        description: `\`\`\`js\n${execResult}\`\`\``
      }
    });
  }
}

const logs = async (msg, args) => {
  const [lines, logType, processNameOrID] = args;

  if (isNaN(lines) || lines < 15) {
    sendErrorMessage(msg.channel, "Invalid number of lines! Make sure you provide a number and one whose value is 15 or above!");
    return;
  }

  if (!["out", "err", "error"].includes(logType)) {
    sendErrorMessage(msg.channel, "Please provide a valid log type! Acceptable types: \`out\`, \`err\`, or \`error\`");
    return;
  }

  const command = `pm2 logs ${processNameOrID} --raw --nostream --${logType} --lines ${lines}`
  let execResult = await execute(msg.channel, command);

  if(execResult !== undefined) {
    if (logType === "out") {
      // Removes header that starts with "[TAILING] Tailing last..." and trailing newlines in it
      execResult = execResult.stdout.split("\n").slice(2).join("\n").trimEnd();
    } else {
      execResult = execResult.stderr;
    }

    try {
      await msg.channel.createMessage({ 
        embed: { 
          color: embedColors.success,
          title: `Tailing last ${lines} lines of ${(logType === "err" ? "error" : logType)} file for process ${processNameOrID}:`,
          description: `\`\`\`js\n${execResult}\`\`\`` 
        } 
      });
    } catch(err) {
      msg.channel.createMessage({
        embed: {
          color: embedColors.error,
          title: `Embed is too long! Details:`,
          description: `\`\`\`js\nExec result is ${execResult.length} characters long\n\n${err}\`\`\``
        }
      });
    }
  }
}

const processes = async (msg) => {
  let allProcesses = await execute(msg.channel, "pm2 jlist");
  if(allProcesses !== undefined) {
    allProcesses = allProcesses.stdout;
  }

  const formattedProcesses = JSON.parse(allProcesses).map((process) => {
    return {
      name: `${process.name}`,
      value: `ID: ${process.pm_id}` +
             `\nStatus: ${process.pm2_env.status}` +
             `\nMemory: ${humanFileSize(process.monit.memory, true)}\n`,
      inline: true
    }
  });

  msg.channel.createMessage({
    embed: {
      color: embedColors.normal,
      title: "All PM2 Processes",
      fields: formattedProcesses
    }
  })
}

module.exports = {
  restart: {
    label: "restart",
    generator: restart,
    description: "Restarts a pm2 process.",
    fullDescriptionFields: [
      {
        name: "Usage",
        value: "`;restart [process name or ID]`"
      },
      {
        name: "Aliases",
        value: "`r, start, st`"
      }
    ],
    options: {
      argsRequired: true,
      aliases: ["r", "start"]
    }
  },
  stop: {
    label: "stop",
    generator: stop,
    description: "Stops a pm2 process.",
    fullDescriptionFields: [
      {
        name: "Usage",
        value: "`;stop [process name or ID]`"
      },
      {
        name: "Aliases",
        value: "`s`"
      }
    ],
    options: {
      argsRequired: true,
      aliases: ["s"]
    }
  },
  logs: {
    label: "logs",
    generator: logs,
    description: "Shows the content of either the .out or .err file of a specified pm2 process.",
    fullDescriptionFields: [ 
      { 
        name: "Usage",
        value: "`;logs [lines] [log type] [process name or ID]`\n" +
               "The \"lines\" argument has to be a number and it has to be 15 or above. The \"log type\" " +
               "argument has to be one of these 3 values: out, err, or error."
      } ,
      {
        name: "Aliases",
        value: "`l`"
      }
    ],
    options: { 
      argsRequired: true,
      aliases: ["l"]
    }
  },
  processes: {
    label: "processes",
    generator: processes,
    description: "Shows all pm2 processes.",
    fullDescriptionFields: [
      {
        name: "Usage",
        value: "`;logs`"
      },
      {
        name: "Aliases",
        value: "`p`"
      }
    ],
    options: { aliases: ["p"] }
  }
}