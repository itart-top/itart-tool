import React from 'react';
import { CaretRightOutlined, LockOutlined, UnlockOutlined, PicRightOutlined } from '@ant-design/icons';
import { Collapse, Tag, Button } from 'antd';
import './SideMenu.less';
import jsonToGo from "../../plugin/json-to-go"

const { Panel } = Collapse;
const isPlainObject = obj => Object.prototype.toString.call(obj) === '[object Object]'
const isArray = obj => Object.prototype.toString.call(obj) === '[object Array]'

const buildPHP = data => {
    let result = []
    for (let key in data) {
        let value = data[key]
        if (isPlainObject(value)) { // 对象时
            value = buildPHP(value)
        } else if (isArray(value)) { // 数组时
            if (value.length > 0 && typeof value[0] === "string") {
                value = "[\"" + value.join("\",\"") + "\"]"
            } else {
                value = "[" + value.join(",") + "]" // 数字数组或空数组
            }
        } else if (typeof value === "string") {
            value = `"` + value + `"`
        }
        result.push(`"` + key + `" => ` + value)
    }
    return "[\n" + result.join(",\n") + "\n]";
}

const encodeButtons = [
        {
            name: "编码Unicode",
            code: "to-unicode",
            type: 1,
            value: undefined,
            do: function(val) {
                return val.replace(/([\u4E00-\u9FA5]|[\uFE30-\uFFA0])/g,function(newStr){
                    return "\\u" + newStr.charCodeAt(0).toString(16);
                });
            }
        },
        {
            name: "解码Unicode",
            code: "from-unicode",
            type: 0,
            value: undefined,
            do: (val) => {
                val = val.replace(/\\/g, "%");
                return unescape(val)
            }
        },
        {
            name: "编码UTF-8",
            code: "to-utf-8",
            type: 1,
            value: undefined,
            do: (val) => {
                return val.replace(/[^\u0000-\u00FF]/g, function ($0) {
                    return escape($0).replace(/(%u)(\w { 4 })/gi, "&#x$2; ")
                });
            }
        },
        {
            name: "解码UTF-8",
            code: "from-utf-8",
            type: 0,
            do: (value) => {
                return unescape(value.replace(/&#x/g, '%u').replace(/; /g, ''));
            }
        },
        {
            name: "编码ASCII",
            code: "to-ASCII",
            type: 1,
            do: (val, fix = '&#') => {
                if(val.length < 1){
                    return false;
                }
                const arr = val.split("");
                let txt = '';
                arr.forEach(function(v,i){
                    txt += fix + v.charCodeAt() + ';';
                });
                return txt;
            }
        },
        {
            name: "解码ASCII",
            code: "from-ASCII",
            type: 0,
            do: (val, fix = '&#') => {
                if(val.length < 1){
                    return false;
                }
                const arr = val.split(';');
                let txt = '';
                arr.forEach(function(v,i){
                    txt += String.fromCharCode(v.replace(fix,''));
                });
                return txt;
            }
        },
        {
            name: "编码URL",
            code: "to-url-encode",
            type: 1,
            do: val => {
                return encodeURI(val)
            }
        },
        {
            name: "解码URL",
            code: "from-url-encode",
            type: 0,
            do: val => {
                return decodeURI(val)
            }
        }
    ]
const looksLikeJSON = val => /^\s*[[{"]/.test(val)
const tryParseJSON = str => {
    try {
        return JSON.parse(str)
    } catch (e) {
        return undefined
    }
}

// 先原样解析，失败则补全括号后重试
const parseLooseJSON = str => {
    const parsed = tryParseJSON(str)
    return parsed === undefined ? tryParseJSON(repairJSON(str)) : parsed
}

const parseMaybeJSON = val => {
    if (typeof val !== "string" || !looksLikeJSON(val)) {
        return val
    }
    const parsed = parseLooseJSON(val)
    return parsed === undefined ? val : deepFormat(parsed)
}

const deepFormat = data => {
    if (isArray(data)) {
        return data.map(deepFormat)
    }
    if (isPlainObject(data)) {
        const result = {}
        for (let key in data) {
            result[key] = deepFormat(data[key])
        }
        return result
    }
    if (typeof data === "string") {
        return parseMaybeJSON(data)
    }
    return data
}

// 逐字符扫描 json 文本，维护括号栈与字符串状态；onChar 收到「处理当前字符前」的状态
const scanJSON = (text, onChar) => {
    let stack = ""
    let inStr = false
    let esc = false
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (onChar) {
            onChar(ch, i, stack, inStr)
        }
        if (inStr) {
            if (esc) {
                esc = false
            } else if (ch === "\\") {
                esc = true
            } else if (ch === '"') {
                inStr = false
            }
            continue
        }
        if (ch === '"') {
            inStr = true
        } else if (ch === "{" || ch === "[") {
            stack += ch
        } else if (ch === "}" || ch === "]") {
            const open = ch === "}" ? "{" : "["
            if (stack.slice(-1) === open) {
                stack = stack.slice(0, -1)
            }
        }
    }
    return { stack, inStr }
}

// 按括号配对从文本中切出多条 json，兼容 console 复制导致单条 json 被折行：
// 顶层（括号外）以换行为条目边界，进入 { [ 后只按括号闭合切分，折行不影响
// 例外：括号一直未闭合（上一条被截断）时，顶格的 { [ 也算新条目边界，避免吞掉后续记录
const splitJSONItems = text => {
    const items = []
    let buf = ""
    const flush = () => {
        if (buf.trim()) {
            items.push(buf.trim())
        }
        buf = ""
    }
    scanJSON(text, (ch, i, stack, inStr) => {
        if (ch === "\n" && !inStr && stack.length && /[[{]/.test(text[i + 1] || "")) {
            flush()
            return
        }
        if (!stack.length) {
            if (ch === "\n") {
                flush() // 顶层换行：一条结束
            } else {
                if (!inStr && (ch === "{" || ch === "[") && buf.trim()) {
                    flush() // 括号前的内容（日志前缀等）单独成条，不丢数据
                }
                buf += ch
            }
            return
        }
        buf += ch
        // stack 是「处理当前字符前」的栈，栈里只剩这一个待闭合的左括号时，本条结束
        if ((ch === "}" || ch === "]") && stack.length === 1 && stack[0] === (ch === "}" ? "{" : "[")) {
            flush()
        }
    })
    flush() // 收尾残片交给 repairJSON 修正
    return items
}

// 修复被截断/折行破坏的 json：字符串值里的真实换行转义回去，未闭合的字符串与括号按序补齐
const controlEscapes = { "\n": "\\n", "\r": "\\r", "\t": "\\t" }
const repairJSON = str => {
    const bad = []
    const { stack, inStr } = scanJSON(str, (ch, i, brackets, inString) => {
        if (inString && controlEscapes[ch]) {
            bad.push(i)
        }
    })
    let fixed = str
    for (let k = bad.length - 1; k >= 0; k--) {
        const i = bad[k]
        fixed = fixed.slice(0, i) + controlEscapes[fixed[i]] + fixed.slice(i + 1)
    }
    if (!stack.length && !inStr) {
        return fixed
    }
    if (inStr) {
        fixed += '"'
    }
    for (let i = stack.length - 1; i >= 0; i--) {
        fixed += stack[i] === "{" ? "}" : "]"
    }
    return fixed
}

// 内容每条是一个 json；字段中字符串 json 继续格式化；字段中的 \n 还原为换行
// console 复制造成的折行、粘连、截断都先按括号配对切条，解析失败的条目再补括号修复
const formatContext = val => {
    let data
    if (typeof val === "string") {
        data = tryParseJSON(val)
        if (data === undefined) {
            data = splitJSONItems(val)
        }
    } else {
        data = val
    }
    const items = isArray(data) ? data : [data]
    return items.map(item => {
        if (typeof item === "string") {
            const str = item.trim()
            if (!str) {
                return undefined
            }
            if (!looksLikeJSON(str)) {
                return str
            }
            // 折行本身不破坏 json（括号间的空白合法），解析失败时再试补全括号
            const parsed = parseLooseJSON(str)
            return parsed === undefined ? str : deepFormat(parsed)
        }
        return deepFormat(item)
    }).filter(item => item !== undefined)
}

// 未被 JSON.parse 处理过的文本，手工还原转义符（\n 等）使换行真正显示
const unescapeText = str =>
    str.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
       .replace(/\\r/g, "\r")
       .replace(/\\n/g, "\n")
       .replace(/\\t/g, "\t")
       .replace(/\\"/g, '"')
       .replace(/\\\\/g, "\\")

// 富文本字符串格式化：把一条字符串（含 \n 转义）还原成换行显示的文本
const toPlainText = val => {
    if (typeof val !== "string") {
        return JSON.stringify(deepFormat(val), null, 4)
    }
    let text = val
    let parsedOnce = false
    // 字符串 json 逐层解开（"\"x\n\"" -> "x\n"），解开后转义符已由 JSON.parse 还原
    while (looksLikeJSON(text)) {
        const parsed = parseLooseJSON(text)
        if (parsed === undefined) {
            break
        }
        parsedOnce = true
        if (typeof parsed !== "string") {
            return JSON.stringify(deepFormat(parsed), null, 4)
        }
        text = parsed
    }
    return parsedOnce ? text : unescapeText(text)
}

const formatButtons = [
    {
        name: "JSON格式化",
        code: "json",
        type: "json",
        do: val => {
            return val ? JSON.parse(val): undefined;
        }
    },
    {
        name: "内容格式化",
        code: "context-format",
        type: "json",
        collapsed: 1,
        do: val => {
            if (!val) {
                return undefined;
            }
            return formatContext(val);
        }
    },
    {
        name: "富文本格式化",
        code: "rich-text",
        type: "text",
        do: val => {
            if (!val) {
                return undefined;
            }
            return toPlainText(val);
        }
    }
]

const codeGenButtons = [
    {
        name: "JSON转GO",
        code: "json-to-go",
        type: "1",
        do: function (val) {
            let src = val
            if (typeof val !== "string") {
                src = JSON.stringify(val)
            }
            const resp = jsonToGo(src)
            if (resp.error) {
                return resp.error
            }
            return resp.go;
        }
    },
    {
        name: "JSON转PHP",
        code: "json-to-php",
        type: 1,
        value: undefined,
        do: function(val) {

            return buildPHP(JSON.parse(val))
        }
    },
]
const SideMenu = ({fire}) =>{
    return <Collapse
        bordered={false}
        defaultActiveKey={['2', '3', '4']}
        expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
        className="site-collapse-custom-collapse"
    >
        {/*<Panel header="常用功能" key="1" className="common-panel">
            <p>
                <Tag closable>
                    编码转换
                </Tag>
                <Tag closable>
                    JSON美化
                </Tag>
                <Tag closable>
                    数据抽取
                </Tag>
            </p>
        </Panel>*/}
        <Panel header="编码转换" key="2" className="tool-panel">
            {
                encodeButtons.map(b => {
                    return <Button onClick={() => fire(b)} type={b.type === 1? "primary":""}
                                   key={b.code}
                                   size={"small"} icon={b.type ===1 ? <LockOutlined />: <UnlockOutlined />}>
                        {b.name}
                    </Button>
                })
            }
        </Panel>
        <Panel header="格式转换" key="3" className="tool-panel">
            {
                formatButtons.map(b => {
                    return <Button onClick={() => fire(b)} type={b.type === 1? "primary":""} size={"small"}
                                   key={b.code} icon={<PicRightOutlined />}>
                        {b.name}
                    </Button>
                })
            }
        </Panel>
        <Panel header="代码生成" key="4" className="tool-panel">
            {
                codeGenButtons.map(b => {
                    return <Button type={b.type === 1? "primary":""} onClick={() => fire(b)} size={"small"}
                                   key={b.code} icon={<PicRightOutlined />}>
                        {b.name}
                    </Button>
                })
            }
        </Panel>
    </Collapse>
};

export default SideMenu;
