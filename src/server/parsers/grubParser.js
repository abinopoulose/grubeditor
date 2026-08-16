var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { log, readProtectedFile } from '../utils/fileOps';
export function parseGrubCfg(content) {
    var entries = [];
    var activeKernel = os.release().trim();
    var lines = content.split('\n');
    var currentParentId = undefined;
    var inSubmenu = false;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.startsWith('submenu ') || line.startsWith('submenu\t')) {
            inSubmenu = true;
            var match = line.match(/^submenu\s+((?:['"])(.*?)(?:['"])|(\S+))/);
            if (match) {
                currentParentId = "submenu-".concat(i);
            }
            continue;
        }
        if (inSubmenu && line === '}') {
            inSubmenu = false;
            currentParentId = undefined;
            continue;
        }
        if (line.startsWith('menuentry ') || line.startsWith('menuentry\t')) {
            var title = "Unknown Entry";
            var titleMatch = line.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
            if (titleMatch) {
                title = titleMatch[1] || titleMatch[2] || "Unknown Entry";
            }
            var id = "sys-entry-".concat(entries.length);
            var idMatch = line.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
            if (idMatch) {
                id = idMatch[1] || idMatch[2] || id;
            }
            var blockContent = "";
            var braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
            var j = i + 1;
            while (j < lines.length && (braceDepth > 0 || (braceDepth === 0 && !lines[j].includes('{')))) {
                var bline = lines[j];
                blockContent += bline + "\n";
                braceDepth += (bline.match(/\{/g) || []).length - (bline.match(/\}/g) || []).length;
                if (braceDepth <= 0 && bline.includes('}'))
                    break;
                j++;
            }
            i = j;
            var type = 'custom';
            var args = undefined;
            var version = undefined;
            var isCurrent = false;
            var lowerTitle = title.toLowerCase();
            if (lowerTitle.includes('recovery') || lowerTitle.includes('advanced') || lowerTitle.includes('rescue') || blockContent.toLowerCase().includes('recovery') || blockContent.toLowerCase().includes('single')) {
                type = 'recovery';
            }
            else if (lowerTitle.includes('windows') || blockContent.toLowerCase().includes('chainloader')) {
                type = 'windows';
            }
            else if (lowerTitle.includes('uefi') || lowerTitle.includes('firmware') || blockContent.toLowerCase().includes('fwsetup')) {
                type = 'efi';
            }
            else if (lowerTitle.includes('linux') || lowerTitle.includes('ubuntu') || lowerTitle.includes('debian') || lowerTitle.includes('fedora') || blockContent.includes('linux ') || blockContent.includes('linuxefi ') || blockContent.includes('linux16 ')) {
                type = 'linux';
            }
            var linuxMatch = blockContent.match(/^\s*(?:linux|linuxefi|linux16)\s+(\S+)(.*)$/m);
            if (linuxMatch) {
                var kernelPath = linuxMatch[1];
                args = linuxMatch[2].trim();
                if (type !== 'recovery' && type !== 'windows' && type !== 'efi') {
                    type = 'linux';
                }
                var verMatch = kernelPath.match(/vmlinuz-([a-zA-Z0-9.\-_]+)/i) || kernelPath.match(/kernel-([a-zA-Z0-9.\-_]+)/i);
                if (verMatch) {
                    version = verMatch[1];
                }
            }
            if (!version) {
                var titleVerMatch = title.match(/\b(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9]+)*)\b/);
                if (titleVerMatch) {
                    version = titleVerMatch[1];
                }
            }
            if ((version && version.includes(activeKernel)) || title.includes(activeKernel) || (activeKernel.length > 3 && (version === activeKernel || title.includes(activeKernel)))) {
                isCurrent = true;
            }
            entries.push({
                id: id,
                title: title,
                type: type,
                enabled: true,
                order: entries.length,
                args: args || undefined,
                version: version || undefined,
                isCurrent: isCurrent,
                is_current: isCurrent,
                is_default: entries.length === 0,
                parent_id: currentParentId,
                raw_boot_commands: blockContent.trim(),
            });
        }
    }
    return entries;
}
export function getOverridesPath() {
    if (fs.existsSync('/boot/grub2'))
        return '/boot/grub2/grub-editor-entries.json';
    if (fs.existsSync('/boot/grub'))
        return '/boot/grub/grub-editor-entries.json';
    var dir = path.join(os.homedir(), '.grubdeck');
    if (!fs.existsSync(dir))
        try {
            fs.mkdirSync(dir, { recursive: true });
        }
        catch (_a) { }
    return path.join(dir, 'grub-editor-entries.json');
}
export function getSavedOverrides() {
    try {
        var p = getOverridesPath();
        var content = readProtectedFile(p, 0);
        return JSON.parse(content);
    }
    catch (_a) {
        return [];
    }
}
export function mergeEntriesWithOverrides(systemEntries, overrides) {
    log('MERGE', "Starting merge: ".concat(systemEntries.length, " system entries, ").concat(overrides.length, " overrides"));
    if (!overrides || !Array.isArray(overrides) || overrides.length === 0) {
        log('MERGE', 'No overrides found, returning raw system entries');
        return systemEntries;
    }
    var sysMatched = new Set();
    systemEntries.forEach(function (entry) {
        if (!entry.originalTitle)
            entry.originalTitle = entry.title;
    });
    log('MERGE', 'System entries:', systemEntries.map(function (e, i) { return "[".concat(i, "] id=\"").concat(e.id, "\" title=\"").concat(e.title, "\""); }).join(' | '));
    log('MERGE', 'Overrides:', overrides.map(function (o, i) { return "[".concat(i, "] id=\"").concat(o.id, "\" title=\"").concat(o.title, "\" origTitle=\"").concat(o.originalTitle, "\" deleted=").concat(o.deleted); }).join(' | '));
    var result = [];
    overrides.forEach(function (ov, ovIdx) {
        var matchIdx = systemEntries.findIndex(function (sys, idx) { return !sysMatched.has(idx) && ov.id && sys.id === ov.id && !sys.id.startsWith('sys-entry-'); });
        var matchMethod = 'id';
        if (matchIdx === -1) {
            matchIdx = systemEntries.findIndex(function (sys, idx) {
                if (sysMatched.has(idx))
                    return false;
                var sysOrig = sys.originalTitle || sys.title;
                var ovOrig = ov.originalTitle || ov.title;
                return ovOrig === sys.title || ovOrig === sysOrig || ov.title === sys.title;
            });
            matchMethod = 'title';
        }
        if (matchIdx === -1 && ov.id && ov.id.startsWith('sys-entry-')) {
            var pos = parseInt(ov.id.replace('sys-entry-', ''), 10);
            if (!isNaN(pos) && pos < systemEntries.length && !sysMatched.has(pos)) {
                matchIdx = pos;
                matchMethod = 'positional';
            }
        }
        if (matchIdx !== -1) {
            sysMatched.add(matchIdx);
            log('MERGE', "Override[".concat(ovIdx, "] \"").concat(ov.title, "\" matched system[").concat(matchIdx, "] \"").concat(systemEntries[matchIdx].title, "\" via ").concat(matchMethod));
        }
        else {
            log('MERGE', "Override[".concat(ovIdx, "] \"").concat(ov.title, "\" (origTitle=\"").concat(ov.originalTitle, "\", id=\"").concat(ov.id, "\") had NO match in system entries"));
        }
        if (ov.deleted) {
            var alreadyInResult = result.some(function (e) {
                return (ov.id && e.id === ov.id && !e.id.startsWith('sys-') && !ov.id.startsWith('sys-')) ||
                    ((ov.originalTitle || ov.title) === (e.originalTitle || e.title));
            });
            if (alreadyInResult) {
                log('MERGE', "Override[".concat(ovIdx, "] \"").concat(ov.title, "\" is a DUPLICATE deleted override \u2014 skipping"));
                return;
            }
            log('MERGE', "Override[".concat(ovIdx, "] \"").concat(ov.title, "\" is DELETED (").concat(matchIdx !== -1 ? 'matched & suppressed system entry' : 'preserved deleted override from previous deploy', ")"));
            result.push(__assign(__assign({}, ov), { deleted: true, enabled: false }));
        }
        else if (matchIdx !== -1) {
            var sys = systemEntries[matchIdx];
            result.push(__assign(__assign({}, sys), { title: ov.title !== undefined ? ov.title : sys.title, originalTitle: ov.originalTitle || sys.originalTitle || sys.title, enabled: ov.enabled !== undefined ? ov.enabled : sys.enabled, deleted: false, order: result.length }));
        }
        else {
            result.push(__assign(__assign({}, ov), { deleted: false, order: result.length }));
        }
    });
    var unmatchedCount = 0;
    systemEntries.forEach(function (sys, index) {
        if (!sysMatched.has(index)) {
            unmatchedCount++;
            log('MERGE', "System entry[".concat(index, "] \"").concat(sys.title, "\" was UNMATCHED \u2014 adding to result"));
            result.push(__assign(__assign({}, sys), { originalTitle: sys.originalTitle || sys.title, order: result.length }));
        }
    });
    log('MERGE', "Merge complete: ".concat(result.length, " total entries (").concat(unmatchedCount, " unmatched system entries added)"));
    return result;
}
export function applyOverridesToGrubCfg(content, overrides) {
    if (!overrides || !Array.isArray(overrides) || overrides.length === 0)
        return content;
    var lines = content.split('\n');
    var outputLines = [];
    var extractedBlocks = [];
    var firstMenuIdx = -1;
    var i = 0;
    var entryCount = 0;
    while (i < lines.length) {
        var line = lines[i];
        var trimmed = line.trim();
        if (trimmed.startsWith('submenu ') || trimmed.startsWith('submenu\t')) {
            if (firstMenuIdx === -1)
                firstMenuIdx = outputLines.length;
            i++;
            continue;
        }
        if (trimmed === '}' && firstMenuIdx !== -1 && outputLines.length >= firstMenuIdx) {
            i++;
            continue;
        }
        if (trimmed.startsWith('menuentry ') || trimmed.startsWith('menuentry\t')) {
            if (firstMenuIdx === -1)
                firstMenuIdx = outputLines.length;
            var title = "Unknown Entry";
            var titleMatch = trimmed.match(/^menuentry\s+(?:['"](.*?)['"]|(\S+))/);
            if (titleMatch)
                title = titleMatch[1] || titleMatch[2] || title;
            var id = "sys-entry-".concat(entryCount);
            var idMatch = trimmed.match(/(?:--id|\$menuentry_id_option)\s+(?:['"](.*?)['"]|(\S+))/);
            if (idMatch)
                id = idMatch[1] || idMatch[2] || id;
            var blockLines = [line];
            var braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
            var j = i + 1;
            while (j < lines.length && (braceDepth > 0 || (braceDepth === 0 && !lines[j].includes('{')))) {
                var bline = lines[j];
                blockLines.push(bline);
                braceDepth += (bline.match(/\{/g) || []).length - (bline.match(/\}/g) || []).length;
                if (braceDepth <= 0 && bline.includes('}')) {
                    j++;
                    break;
                }
                j++;
            }
            extractedBlocks.push({ id: id, title: title, lines: blockLines, origIdx: entryCount });
            entryCount++;
            i = j;
            continue;
        }
        outputLines.push(line);
        i++;
    }
    if (firstMenuIdx === -1 || extractedBlocks.length === 0)
        return content;
    var processedBlocks = [];
    var matchedOrigIndices = new Set();
    overrides.forEach(function (ov, ovIndex) {
        var matchIdx = extractedBlocks.findIndex(function (b, idx) { return !matchedOrigIndices.has(idx) && ov.id && b.id === ov.id && !b.id.startsWith('sys-entry-'); });
        if (matchIdx === -1) {
            matchIdx = extractedBlocks.findIndex(function (b, idx) { return !matchedOrigIndices.has(idx) && (ov.originalTitle === b.title || ov.title === b.title); });
        }
        if (matchIdx === -1 && ov.id && ov.id.startsWith('sys-entry-')) {
            var pos = parseInt(ov.id.replace('sys-entry-', ''), 10);
            if (!isNaN(pos) && !matchedOrigIndices.has(pos))
                matchIdx = pos;
        }
        if (matchIdx !== -1) {
            matchedOrigIndices.add(matchIdx);
        }
        if (ov.deleted || ov.enabled === false)
            return;
        if (matchIdx !== -1) {
            var block = extractedBlocks[matchIdx];
            var firstLine = block.lines[0];
            if (ov.title && ov.title !== block.title) {
                firstLine = firstLine.replace(block.title, ov.title);
                block.lines[0] = firstLine;
            }
            processedBlocks.push({ idx: ovIndex, text: block.lines.join('\n') });
        }
    });
    extractedBlocks.forEach(function (block, idx) {
        if (!matchedOrigIndices.has(idx)) {
            processedBlocks.push({ idx: processedBlocks.length + 1000, text: block.lines.join('\n') });
        }
    });
    processedBlocks.sort(function (a, b) { return a.idx - b.idx; });
    var finalMenuSection = processedBlocks.map(function (b) { return b.text; }).join('\n\n');
    outputLines.splice(firstMenuIdx, 0, finalMenuSection);
    return outputLines.join('\n');
}
