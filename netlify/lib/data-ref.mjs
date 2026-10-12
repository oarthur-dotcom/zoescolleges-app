// Which version of the data repo the site reads (#37, Oct 11). jsDelivr's "@live" branch link was serving
// copies hours old even after purges; a link to an exact commit is always served exactly.
// RELEASE STEP: set this to the data repo's new `live` commit in the same release (index.html has the same value).
export const DATA_REF = "88a3050";
export const DATA_BASE = `https://cdn.jsdelivr.net/gh/oarthur-dotcom/zoescolleges-data@${DATA_REF}`;
