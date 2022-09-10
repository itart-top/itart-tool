import React from 'react';
import { CaretRightOutlined, LockOutlined, UnlockOutlined, PicRightOutlined } from '@ant-design/icons';
import { Collapse, Tag, Button } from 'antd';
import './SideMenu.less';
import jsonToGo from "../plugin/json-to-go"

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
const formatButtons = [
    {
        name: "JSON格式化",
        code: "json",
        type: "json",
        do: val => {
            return val ? JSON.parse(val): undefined;
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
