using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace ItemExportWin
{
    public class GroupInfo
    {
        public string Key;
        public string Name;
        public string Description;
        public ulong GroupId;
        public ulong ParentId;
        public string ParentKey;
        public int Depth;
        public bool SchematicRequired;
    }

    public static class MyDuData
    {
        public static string DuYaml { get; set; } = string.Empty;
        public static System.Collections.Generic.List<object>? BankDocs { get; set; }

        public static readonly Dictionary<string, string> NameMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        public static readonly Dictionary<string, JObject> DocMap = new Dictionary<string, JObject>(StringComparer.OrdinalIgnoreCase);
        public static readonly Dictionary<string, ulong> IdMap = new Dictionary<string, ulong>(StringComparer.OrdinalIgnoreCase);
        public static readonly Dictionary<string, GroupInfo> ParentMap = new Dictionary<string, GroupInfo>(StringComparer.OrdinalIgnoreCase);
    }
}
