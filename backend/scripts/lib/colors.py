import logging


def convertRGBtoHEX(rgbList: list[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(int(rgbList[0]), int(rgbList[1]), int(rgbList[2]))


def convertHEXToRGB(hexColor: str) -> list:
    return [int(hexColor.lstrip('#')[i:i+2], 16) for i in (0, 2, 4)]


def saturateRGB(rgbList: list[int, int, int], factor: float) -> list[int, int, int]:
    if not 0 < factor:
        logging.warning("Cannot input a factor lower than 0, set to 0")
        factor = 0
    saturatedRgbList = []
    for value in rgbList:
        value *= factor
        if value >= 255:
            value = 255
        saturatedRgbList.append(value)
    return saturatedRgbList


def saturateHEX(hexColor: str, factor: float) -> str:
    rgbList = convertHEXToRGB(hexColor)
    rgbList = saturateRGB(rgbList, factor)
    return convertRGBtoHEX(rgbList)
