#!/usr/bin/env node

// nya!~ :3
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config"
import fs from "fs";
import { exec, execSync } from "child_process";
import terminal from "terminal-kit";
import { diffLines } from "diff";
const term = terminal.terminal;

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
	model: "gemini-2.0-flash-exp"
});
let prompt = "Solve any git merge conflicts in the file below, and try to use the better options for code. Only respond with the final file contents, but do not use markdown code blocks. Ensure that the file is in a valid state after the merge.";

// Documentation
if (process.argv.includes("--document") || process.argv.includes("-d")) {
	prompt += " Add accurate and concise documentation through the form of comments. Use a similar naming scheme to existing comments and code.";
}

// Check whether we're in a git repo
if (!fs.existsSync(".git")) {
	term.red("Not a git repository.");
	term.processExit(1);
	process.exit(1);
}
// check for the help flag	
if (process.argv.includes("--help") || process.argv.includes("-h")) {
	term.white("Usage: mergeflow <file> [--document] [--quiet] [--help]");
	term.processExit(0);
	process.exit(0);
}

// Check for unmerged files
const status = execSync("git status --porcelain").toString();
const files = status.split("\n").filter(line => line.includes("U")).map(line => line.split(" ")[1]);

if (files.length == 0) {
	term.green("No merge conflicts found. Awesome!");
	term.processExit(0);
	process.exit(0);
} else {
	// Hammer time.
	files.forEach(file => {
		merge(file);
	});
}



// Quiet mode
const isQuietMode = process.argv.includes("--quiet") || process.argv.includes("-q");
if (isQuietMode) {
	term.green("Running in quiet mode - changes will be applied automatically\n");
}

async function merge(file) {
	// Read the original text
	const originalText = fs.readFileSync(file);
	const data = {
		inlineData: {
			data: Buffer.from(originalText).toString("base64"),
			mimeType: "text/plain",
		}
	}

	// Create a frame for the progress
	term.clear();
	term.moveTo(1, 1);
	term.cyan('╭─ MergeFlow ').green('resolving conflicts\n');
	term.cyan('├ File: ').white(file + '\n');
	term.cyan('╰─');

	// You spin me right round baby right round
	let spinner = await term.spinner("dotSpinner");
	const result = await model.generateContent([prompt, data]); // generate!
	const text = result.response.text();
	spinner.animate(false);

	// Clear the spinner line
	term.previousLine(1);
	term.eraseLine();
	term.cyan('╰─ ').green('✓ Resolution complete\n\n');

	// Show diff
	term.cyan('Changes:\n');
	term.cyan('╭─────────────────────────────\n');
	// diff it!!!
	diffLines(originalText.toString('utf-8'), text).forEach(part => {
		let prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
		let color = part.added ? 'green' : part.removed ? 'red' : 'white';
		term[color](prefix + part.value);
	});
	term.cyan('╰─────────────────────────────\n\n');

	// Confirm overwrite
	term.cyan('╭─ Confirm changes\n');
	term.cyan('├ ').white('Press ').cyan('[Y]').white(' to save, ').cyan('[N]').white(' to discard\n');
	term.cyan('╰─ ');
	term.yesOrNo({ yes: ['y', 'ENTER'], no: ['n'] }, function (error, result) {
		if (result || isQuietMode) {
			// Overwrite the og file
			fs.writeFileSync(file, Buffer.from(text, "utf-8"));
			term.green("\n✓ Changes saved successfully\n");
			term.processExit(0);
		} else {
			term.red("\n✗ Changes discarded\n");
			term.processExit(0);
		}
	});
}

// Prompt whether to create a commit
term.cyan('\n╭─ Commit Changes\n');
term.cyan('├ ').white('Message: ').green('Automated merge conflict resolution\n');
term.cyan('├ ').white('Author: ').green('MergeFlow\n'); // branded!!!
term.cyan('├ ').white('Press ').cyan('[Y]').white(' to commit, ').cyan('[N]').white(' to skip\n'); // give the user to do it themselves
term.cyan('╰─ ');

term.yesOrNo({ yes: ['y', 'ENTER'], no: ['n'] }, function (error, result) {
	if (result || process.argv.includes("-y")) {
		term.cyan('\n╭─ Committing changes...');
		// Commit the changes
		exec("git add . && git commit --author='MergeFlow <>' -m 'Automated merge conflict resolution'", (err, stdout, stderr) => {
			if (err) {
				term.red("\n├─ ✗ Error: Failed to commit changes");
				term.red("\n╰─ " + err.message + "\n");
				term.processExit(1);
			}
			term.green("\n├─ ✓ Changes staged");
			term.green("\n╰─ ✓ Commit successful\n");
			term.processExit(0);
		});
	} else {
		term.yellow("\n╰─ ○ Commit skipped\n");
		term.processExit(0);
	}
});