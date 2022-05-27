import { promises as fs } from "fs";
import jsonPatch from 'fast-json-patch';

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
const previousDatafile = await readDataFileObjectFromDisk("./datafile-previous.json");
const newDatafile = await readDataFileObjectFromDisk("./datafile-new.json");

const patches = jsonPatch.compare(previousDatafile, newDatafile);
// console.dir(patches, {depth: null});

const allTargetPaths = patches.map(patch => patch.path.match(/(\/featureFlags\/\d)|(\/rollouts\/\d)|(\/experiments\/\d)|(\/audiences\/\d)/gm)[0]);
// console.dir(allTargetPaths, {depth: null});

const distinctTargetPaths = [...new Set(allTargetPaths)];
// console.dir(distinctTargetPaths, {depth: null});

const distinctTargetObjects = distinctTargetPaths.map(path => {
    let foundObject = jsonPatch.getValueByPointer(newDatafile, path);

    // if a node was removed then look at previous
    if (typeof foundObject === "undefined") {
        foundObject = jsonPatch.getValueByPointer(previousDatafile, path);
    }

    // set the type of object
    if (path.startsWith("/featureFlags/")) {
        foundObject.type = "flag";
    } else if (path.startsWith("/rollouts/")) {
        foundObject.type = "rollout";
    } else if (path.startsWith("/experiments/")) {
        foundObject.type = "experiment";
    } else if (path.startsWith("/audiences/")) {
        foundObject.type = "audience";
    } else {
        throw new Error("Unknown JSON Pointer type found");
    }

    return foundObject;
});
// console.dir(distinctTargetObjects, {depth: null});

const allFeatureFlags = [...newDatafile.featureFlags, ...previousDatafile.featureFlags];
const allRollouts = [...newDatafile.rollouts, ...previousDatafile.rollouts];
const experimentsFromRollouts = allRollouts.map(rollout => [...rollout.experiments]).reduce((accumulator, experiment) => [...accumulator, ...experiment]);
const experimentsFromExperiments = [...newDatafile.experiments, ...previousDatafile.experiments];
const allExperiments = [...experimentsFromRollouts, ...experimentsFromExperiments];

const featureFlagsSearchBy = {
    flag: (featureFlag) => {
        return [featureFlag];
    },
    rollout: (rollout) => {
        const rolloutId = rollout.id.toString();
        const foundFeatureFlags = allFeatureFlags.filter(featureFlag => featureFlag.rolloutId === rolloutId);
        return foundFeatureFlags;
    },
    experiment: (experiment) => {
        const experimentId = experiment.id.toString();
        const foundFeatureFlags = allFeatureFlags.filter(featureFlag => featureFlag.experimentIds.includes(experimentId));
        return foundFeatureFlags;
    },
    audience: (audience) => {
        const audienceId = audience.id.toString();
        const experimentsContainingAudienceId = allExperiments.filter(experiment => experiment.audienceIds.includes(audienceId));
        const foundFeatureFlags = allFeatureFlags.filter(featureFlag => experimentsContainingAudienceId.find(experiment => featureFlag.experimentIds.includes(experiment.id)));
        return foundFeatureFlags;
    },
};

const affectedFeatureFlagKeys = distinctTargetObjects.map(target => {
    const foundFeatureFlags = featureFlagsSearchBy[target.type](target);
    const featureFlagKeys = foundFeatureFlags.map(featureFlag => featureFlag.key);
    return featureFlagKeys;
});
const distinctAffectedFeatureFlagKeys = [...new Set(affectedFeatureFlagKeys.filter(key => key.length > 0).flat())];
console.dir(distinctAffectedFeatureFlagKeys);