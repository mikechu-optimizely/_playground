import { promises as fs  } from "fs";
import jsonPatch from 'fast-json-patch';

const PREVIOUS_DATAFILE_PATH = "./datafile-previous.json";
const NEW_DATAFILE_PATH = "./datafile-new.json";

const readDataFileObjectFromDisk = async filePath => {
    let buffer;
    try {
        buffer = await fs.readFile(filePath);
    } catch (e) {
        console.log(e);
        return;
    }

    if (buffer.length < 0) {
        return;
    }
    return JSON.parse(buffer.toString());
};

const previousDatafile = await readDataFileObjectFromDisk(PREVIOUS_DATAFILE_PATH);
const newDatafile = await readDataFileObjectFromDisk(NEW_DATAFILE_PATH);

const patches = jsonPatch.compare(previousDatafile, newDatafile);
console.dir(patches, {depth: null});
