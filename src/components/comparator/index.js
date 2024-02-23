import React, {useEffect, useState} from 'react'
import {Col, Input, Row, Space} from 'antd';
import { Button } from 'antd';
import { Viewer } from 'json-diff-kit';
import  {  Differ } from 'json-diff-kit';
import 'json-diff-kit/dist/viewer.css';

const { TextArea } = Input;

const differ = new Differ({
    detectCircular: true,    // default `true`
    maxDepth: Infinity,      // default `Infinity`
    showModifications: true, // default `true`
    arrayDiffMethod: 'lcs',  // default `"normal"`
});

const Comparator = ()=> {
    const [winHeight, setWinHeight] = useState(100);
    const [leftValue, setLeftValue] = useState("");
    const [leftErr, setLeftErr] = useState("");
    const [rightValue, setRightValue] = useState("");
    const [rightErr, setRightErr] = useState("");
    const [isEdit, setEdit] = useState(true);
    // const [isSplit, setSplit] = useState(true);
    const [diff, setDiff] = useState([]);

    const resizeHandler = () =>  {
        setWinHeight(window.innerHeight -150)
    }
    useEffect(() => {
        resizeHandler()
        window.addEventListener('resize', resizeHandler)
        return () => {
            window.removeEventListener('resize', resizeHandler)
        }

    }, []);

    const onBeautify = () => {
        let success = true
        if (leftValue.trim() !== "") {
            try {
                const leftJson = JSON.parse(leftValue)
                setLeftValue(JSON.stringify(leftJson, null, 2))
            } catch (e) {
                setLeftErr(`格式错误：${e}`)
                success = false
            }
        }
        if (rightValue.trim() !== "") {
            try {
                const rightJson = JSON.parse(rightValue)
                setRightValue(JSON.stringify(rightJson, null, 2))
            } catch (e) {
                setRightErr(`格式错误：${e}`)
                success = false
            }
        }
        return success
    }

    const onDiff = () => {
        if (onBeautify()) {
            setDiff(differ.diff(JSON.parse(leftValue), JSON.parse(rightValue)))
            setEdit(false)
        }
    }

    return <div>
        <Row style={{marginTop: '68px', marginBottom: "5px"}}>
            <Col span={24}>
                <Space>
                    <Button onClick={onBeautify}>美化</Button>
                    {isEdit && <Button type="primary" onClick={onDiff}>比较</Button>}
                    {!isEdit && <Button type="primary" onClick={() => setEdit(true)}>编辑</Button>}
                   {/* {!isEdit && !isSplit && <Button type="primary" onClick={() => setSplit(true)}>左右</Button>}
                    {!isEdit && isSplit && <Button type="primary" onClick={() => setSplit(false)}>上下</Button>}*/}
                </Space>
            </Col>
        </Row>
        {isEdit && <Row >
            <Col span={12}>
                {leftErr && <div style={{color: "red"}}>{leftErr}</div>}
                <TextArea value={leftValue}  style={{ height: winHeight }}
                          onChange={e => {
                              setLeftValue(e.target.value)
                              setLeftErr("")
                          }}
                />
            </Col>
            <Col span={12}>
                {rightErr && <div style={{color: "red"}}>{rightErr}</div>}
                <TextArea value={rightValue}   style={{ height: winHeight }} onChange={e => {
                    setRightValue(e.target.value)
                    setRightErr("")
                }}/>
            </Col>
        </Row>}

        {!isEdit && <Row >
            <Col span={24}>
               {/* <ReactDiffViewer
                    oldValue={leftValue}
                    newValue={rightValue}
                    splitView={isSplit}
                />*/}
                <Viewer
                    diff={diff}          // required
                    indent={4}                 // default `2`
                    lineNumbers={true}         // default `false`
                    highlightInlineDiff={true} // default `false`
                    inlineDiffOptions={{
                        mode: 'word',            // default `"char"`, but `"word"` may be more useful
                        wordSeparator: ' ',      // default `""`, but `" "` is more useful for sentences
                    }}
                />
            </Col>
        </Row>}

    </div>
}

export default Comparator
