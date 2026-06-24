using System.Text.Json;

namespace Vexnor.Core.Manifest;

public static class ManifestLoader
{
    /// <summary>
    /// Supported manifest schema version.
    /// </summary>
    public const int SupportedVersion = 1;

    /// <summary>
    /// Minimum compatible generator version (semver major must match).
    /// </summary>
    public const int SupportedMajor = 1;

    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>
    /// Deserializes a manifest from a JSON string and validates version compatibility.
    /// </summary>
    public static QueryManifest Load(string json)
    {
        var manifest = JsonSerializer.Deserialize<QueryManifest>(json, Options)
            ?? throw new InvalidOperationException("Failed to deserialize query manifest");

        ValidateVersion(manifest);
        return manifest;
    }

    /// <summary>
    /// Loads a manifest from a single JSON file.
    /// </summary>
    public static QueryManifest LoadFile(string path)
    {
        var json = File.ReadAllText(path);
        return Load(json);
    }

    /// <summary>
    /// Loads all manifest JSON files matching a glob pattern and merges them.
    /// </summary>
    public static QueryManifest LoadGlob(string directory, string pattern = "*.json")
    {
        var files = Directory.GetFiles(directory, pattern, SearchOption.AllDirectories);
        if (files.Length == 0)
            throw new FileNotFoundException($"No manifest files found matching '{pattern}' in '{directory}'");

        QueryManifest? merged = null;

        foreach (var file in files.OrderBy(f => f))
        {
            var manifest = LoadFile(file);
            if (merged == null)
            {
                merged = manifest;
            }
            else
            {
                foreach (var (hash, query) in manifest.Queries)
                {
                    merged.Queries[hash] = query;
                }
            }
        }

        return merged!;
    }

    private static void ValidateVersion(QueryManifest manifest)
    {
        if (manifest.Version != SupportedVersion)
            throw new InvalidOperationException(
                $"Unsupported manifest version {manifest.Version}. This SDK supports version {SupportedVersion}.");

        if (!string.IsNullOrEmpty(manifest.GeneratorVersion))
        {
            var parts = manifest.GeneratorVersion.Split('.');
            if (parts.Length > 0 && int.TryParse(parts[0], out var major) && major != SupportedMajor)
                throw new InvalidOperationException(
                    $"Incompatible generator version {manifest.GeneratorVersion}. This SDK supports major version {SupportedMajor}.x.");
        }
    }
}
